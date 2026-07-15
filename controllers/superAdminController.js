
import { Admin } from "../models/admin/Admin.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateRandomString, getExpirationTime } from "../utils/helpers.js";
import { sendPasswordMail, sendForgotPasswordMail } from "../utils/email.js";


import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);




export const addAdminHandle = async (req, res) => {
    try {
        const { name, email, phone} = req.body;

        const schema = Joi.object({
            name: Joi.string().required(),
            email: Joi.string().required(),
            phone: Joi.string().required(),
        });

        const { error } = schema.validate(req.body);

        if (error)
            return res
                .status(400)
                .json(new ApiResponse(400, {}, error.details[0].message));

        // Check if parent already exists
        const existingAdmin = await Admin.findOne({
            $or: [{ email }, { phone }],
        });
        if (existingAdmin) {
            let msg = email == existingAdmin.email ? "email" : "phone number";
            return res
                .status(401)
                .json(new ApiResponse(400, {}, `${msg} already exists`));
        }

        const randomPassword = await generateRandomString(15);

        // Create new parent
        const newParent = new Admin({
            name,
            email,
            phone,
            password: randomPassword,
        });
        await newParent.save();

        // Send password via email
        await sendPasswordMail(name, email, randomPassword);

        return res
            .status(201)
            .json(new ApiResponse(201, {}, `${name} admin registered successfully`));
    } catch (error) {
        console.error(`Error while addin admins:`, error);
        return res
            .status(501)
            .json(new ApiResponse(500, {}, `Internal server error`));
    }
};



// export const addSchoolHandle = async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       address,
//       location,
//       contactInfo = {},
//       facilities = [],
//       ageGroups = [],
//       fees = {},
//       timings,
//       principalName,
//       establishedYear,
//       affiliation,
//       curriculum = [],
//     } = req.body;

//     const { email, phone } = contactInfo;

//     // Validation schema (keep your existing schema)
//     const schema = Joi.object({
//       name: Joi.string().trim().min(2).max(100).required(),
//       description: Joi.string().optional(),

//       address: Joi.object({
//         street: Joi.string().required(),
//         city: Joi.string().required(),
//         state: Joi.string().required(),
//         zipCode: Joi.string().required(),
//         country: Joi.string().required(),
//       }).required(),

//       location: Joi.object({
//         coordinates: Joi.array().items(Joi.number()).length(2).required(), // [lng, lat]
//       }).required(),

//       contactInfo: Joi.object({
//         phone: Joi.string().optional(),
//         email: Joi.string().optional(),
//         website: Joi.string().optional(),
//       }).optional(),

//       facilities: Joi.array().items(Joi.string().min(1)).optional(),

//       ageGroups: Joi.array()
//         .items(
//           Joi.object({
//             name: Joi.string().required(),
//             minAge: Joi.number().min(0).required(),
//             maxAge: Joi.number().greater(Joi.ref("minAge")).required(),
//           })
//         )
//         .optional(),

//       fees: Joi.object({
//         admissionFee: Joi.number().min(0).optional(),
//         monthlyFee: Joi.number().min(0).optional(),
//         annualFee: Joi.number().min(0).optional(),
//       }).optional(),

//       timings: Joi.object({
//         openTime: Joi.string().required(), // HH:mm 24hr format
//         closeTime:
//           Joi.string()
//             .required(),
//         workingDays: Joi.array().items(Joi.string()).min(1).required(),
//       }).required(),

//       principalName: Joi.string().min(2).max(100).optional(),
//       establishedYear: Joi.number().integer().optional(),
//       affiliation: Joi.string().optional(),
//       curriculum: Joi.array().items(Joi.string().min(2)).optional(),
//       captions: Joi.array().items(Joi.string().max(200)).optional(),
//     });

//     const { error } = schema.validate(req.body);
//     if (error) {
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     // Check for existing school
//     if (email || phone) {
//       const existing = await School.findOne({
//         $or: [
//           ...(email ? [{ "contactInfo.email": email }] : []),
//           ...(phone ? [{ "contactInfo.phone": phone }] : []),
//         ],
//       });
//       if (existing) {
//         return res
//           .status(400)
//           .json(
//             new ApiResponse(
//               400,
//               {},
//               "School with this email or phone already exists"
//             )
//           );
//       }
//     }

//     // Handle file uploads
//     let photoArray = [];
//     if (req.files && req.files.length > 0) {
//       const captions = req.body.captions;
//       const captionsArray = Array.isArray(captions) ? captions : [captions];
//       req.files.forEach((file, index) => {
//         photoArray.push({
//           url: file.filename,
//           caption: captionsArray[index] || null,
//         });
//       });
//     }
    
//     const randomPassword = await generateRandomString(15);
//     // Create new school
//     const school = new School({
//       name,
//       description,
//       address,
//       location,
//       contactInfo,
//       facilities,
//       ageGroups,
//       fees,
//       images: photoArray,
//       password: randomPassword,
//       timings,
//       principalName,
//       establishedYear,
//       affiliation,
//       curriculum,
//     });

//     await school.save();
//     await sendPasswordMail(principalName, email, randomPassword)

//     return res
//       .status(201)
//       .json(
//         new ApiResponse(
//           200,
//           school._id,
//           `School ${school.name} added successfully`
//         )
//       );
//   } catch (error) {
//     console.error("Error adding school:", error);
//     return res
//       .status(500)
//       .json(new ApiResponse(500, {}, `Internal server error`));
//   }
// };






