import { School } from "../models/schools/school.js";
import { Child } from "../models/parent/ChildForm.js";

import { Admin } from "../models/admin/Admin.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateRandomString, getExpirationTime } from "../utils/helpers.js";
import { sendPasswordMail, sendForgotPasswordMail } from "../utils/email.js";
import { uploadFile } from "../utils/customUploader.js";

import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Teacher } from "../models/teacher/Teacher.js";
import { Room } from "../models/schools/Room.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const addSchoolHandle = async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      location,
      contactInfo = {},
      facilities = [],
      ageGroups = [],
      fees = {},
      timings,
      principalName,
      establishedYear,
      affiliation,
      curriculum = [],
    } = req.body;

    const { email, phone } = contactInfo;

    // Validation schema (keep your existing schema)
    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      description: Joi.string().optional(),

      address: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required(),
      }).required(),

      location: Joi.object({
        coordinates: Joi.array().items(Joi.number()).length(2).required(), // [lng, lat]
      }).required(),

      contactInfo: Joi.object({
        phone: Joi.string().optional(),
        email: Joi.string().optional(),
        website: Joi.string().optional(),
      }).optional(),

      facilities: Joi.array().items(Joi.string().min(1)).optional(),

      ageGroups: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            minAge: Joi.number().min(0).required(),
            maxAge: Joi.number().greater(Joi.ref("minAge")).required(),
          })
        )
        .optional(),

      fees: Joi.object({
        admissionFee: Joi.number().min(0).optional(),
        monthlyFee: Joi.number().min(0).optional(),
        annualFee: Joi.number().min(0).optional(),
      }).optional(),

      timings: Joi.object({
        openTime: Joi.string().required(), // HH:mm 24hr format
        closeTime: Joi.string().required(),
        workingDays: Joi.array().items(Joi.string()).min(1).required(),
      }).required(),

      principalName: Joi.string().min(2).max(100).optional(),
      establishedYear: Joi.number().integer().optional(),
      affiliation: Joi.string().optional(),
      curriculum: Joi.array().items(Joi.string().min(2)).optional(),
      captions: Joi.array().items(Joi.string().max(200)).optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check for existing school
    if (email || phone) {
      const existing = await School.findOne({
        $or: [
          ...(email ? [{ "contactInfo.email": email }] : []),
          ...(phone ? [{ "contactInfo.phone": phone }] : []),
        ],
      });
      if (existing) {
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              {},
              "School with this email or phone already exists"
            )
          );
      }
    }

    // Handle file uploads
    let photoArray = [];
    if (req.files && req.files.length > 0) {
      const captions = req.body.captions;
      const captionsArray = Array.isArray(captions) ? captions : [captions];
      
      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];
        try {
          const uploadedUrl = await uploadFile(file, { folder: "school-images", publicRead: true });
          
          let fullUrl = uploadedUrl;
          
          if (uploadedUrl && !uploadedUrl.startsWith('http')) {
            const region = process.env.AWS_REGION || 'eu-north-1';
            const bucket = process.env.AWS_S3_BUCKET_NAME;
            fullUrl = `https://${bucket}.s3.${region}.amazonaws.com${uploadedUrl}`;
          }
          
          console.log(`Full Image URL saved: ${fullUrl}`);
          
          photoArray.push({
            url: fullUrl,
            caption: captionsArray[index] || null,
          });
        } catch (uploadError) {
          console.error(`Error uploading file ${file.originalname}:`, uploadError);
          throw uploadError;
        }
      }
    }

    console.log(`Complete photo array:`, JSON.stringify(photoArray, null, 2));

    const school = new School({
      name,
      description,
      address,
      location,
      contactInfo,
      facilities,
      ageGroups,
      fees,
      images: photoArray,
      timings,
      principalName,
      establishedYear,
      affiliation,
      curriculum,
      adminId: req.user.id,
    });

    await school.save();

    return res
      .status(201)
      .json(
        new ApiResponse(
          200,
          school._id,
          `School ${school.name} added successfully`
        )
      );
  } catch (error) {
    console.error("Error adding school:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const loginHandle = async (req, res) => {
  try {
    const { email, password } = req.body;

    const schema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    // Find parent by email
    const admin = await Admin.findOne({ email });
    if (!admin)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, `Invalid email or password`));

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid email or password"));

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );

    const userData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, { userData, token }, "Login successful"));
  } catch (error) {
    console.error("Error logging in parent:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const forgotPasswordHandle = async (req, res) => {
  try {
    const { email } = req.body;

    const schema = Joi.object({
      email: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const actToken = await generateRandomString(8);
    const linkExpireAt = getExpirationTime();
    // Find parent by email
    const admin = await Admin.findOne({ email });
    if (!admin)
      return res.status(404).json(new ApiResponse(404, {}, `admin not found`));

    admin.actToken = actToken;
    admin.linkExpireAt = linkExpireAt;
    await admin.save();

    await sendForgotPasswordMail(
      admin.name,
      admin.email,
      admin.actToken,
      `admin`
    );

    return res
      .status(200)
      .json(new ApiResponse(200, {}, `Password reset link sent to your email`));
  } catch (error) {
    console.error(`Error in forgot password:`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const verifyPasswordHandle = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id)
      return res.status(400).json(new ApiResponse(400, {}, "Invalid link"));

    // Find parent by activation token
    const admin = await Admin.findOne({ actToken: id });
    if (admin) {
      if (admin.linkExpireAt < new Date()) {
        return res.render("linkExpired", {
          msg: "Link expired, please request a new one",
        });
      }
      res.render("forgotAdminPassword", { msg: "", vertoken: admin.actToken });
    } else {
      res.render("forgotAdminPassword", { msg: "Invalid link" });
    }
  } catch (error) {
    console.error("Error verifying password:", error);
    res.render("error", { msg: "Invalid link" });
  }
};

export const changePasswordHandle = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const schema = Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
      confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
    });
    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    // Find parent by activation token
    const admin = await Admin.findOne({ actToken: token });
    if (!admin)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "admin not found or invalid token"));

    admin.password = newPassword;
    admin.actToken = null;

    await admin.save();

    res.render("passwordSuccess", { msg: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.render("error", { msg: "Invalid link" });
  }
};

export const teacherStatusUpdate = async (req, res) => {
  try {
    const { status, teacherId } = req.body;
    const schema = Joi.object({
      status: Joi.number().required(),
      teacherId: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);

    if (error)
      return res
        .status(401)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const teacher = await Teacher.findOne({ _id: teacherId }).populate(
      "schoolId"
    );
    if (!teacher)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `teacher not found`));

    if (teacher.schoolId.adminId.toString() !== req.user.id)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Unauthorized access`));

    teacher.status = status;
    await teacher.save();

    let msg = status == 1 ? `Pending` : status == 2 ? `Approved ` : `Rejected`;

    return res
      .status(201)
      .json(new ApiResponse(200, {}, `${msg} status updated successfully`));
  } catch (error) {
    console.log(`error while update teacher status`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const childStatusUpdate = async (req, res) => {
  try {
    const { status, childId } = req.body;
    const schema = Joi.object({
      status: Joi.number().required(),
      childId: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);

    if (error)
      return res
        .status(401)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const child = await Child.findOne({ _id: childId }).populate("schoolId");
    if (!child)
      return res.status(404).json(new ApiResponse(404, {}, `child not found`));

    if (child.schoolId.adminId.toString() !== req.user.id)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Unauthorized access`));

    child.status = status;
    await child.save();

    let msg = status == 1 ? `Pending` : status == 2 ? `Approved ` : `Rejected`;

    return res
      .status(201)
      .json(new ApiResponse(200, {}, `${msg} status updated successfully`));
  } catch (error) {
    console.log(`error while update child status`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const assignChildrenToRoom = async (req, res) => {
  try {
    const { roomId, schoolId, teacherId, studentIds } = req.body;

    const schema = Joi.object({
      roomId: Joi.string().required(),
      schoolId: Joi.string().required(),
      teacherId: Joi.string().required(),
      studentIds: Joi.array().items(Joi.string()).min(1).required(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));
    }

    // Validate ObjectId formats for room, school, teacher and student ids
    const invalidFormatIds = [];
    if (!mongoose.Types.ObjectId.isValid(roomId))
      invalidFormatIds.push(`roomId: ${roomId}`);
    if (!mongoose.Types.ObjectId.isValid(schoolId))
      invalidFormatIds.push(`schoolId: ${schoolId}`);
    if (!mongoose.Types.ObjectId.isValid(teacherId))
      invalidFormatIds.push(`teacherId: ${teacherId}`);
    const incomingIds = Array.isArray(studentIds) ? studentIds : [];
    const invalidStudentFormat = incomingIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidStudentFormat.length) {
      invalidFormatIds.push(`studentIds: ${invalidStudentFormat.join(", ")}`);
    }

    if (invalidFormatIds.length) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `Invalid id format(s): ${invalidFormatIds.join("; ")}`
          )
        );
    }

    // Verify the room exists and belongs to school
    const room = await Room.findOne({ _id: roomId, schoolId });
    if (!room) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Room not found in this school`));
    }

    // Verify teacher exists and belongs to school
    const teacher = await Teacher.findOne({ _id: teacherId }).populate(
      "schoolId"
    );
    if (!teacher) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Teacher not found`));
    }

    if (
      teacher.schoolId._id.toString() !== schoolId ||
      teacher.schoolId.adminId.toString() !== req.user.id
    ) {
      return res
        .status(401)
        .json(new ApiResponse(401, {}, `Unauthorized Access`));
    }

    // Verify all students exist and belong to school and dedupe incoming IDs
    const invalidStudents = [];
    const foundStudents = {};
    const incomingUniqueIds = Array.from(
      new Set((studentIds || []).map((id) => id.toString()))
    );

    for (const id of incomingUniqueIds) {
      const student = await Child.findById(id);
      if (!student || student.schoolId.toString() !== schoolId) {
        invalidStudents.push(id);
      } else {
        foundStudents[id] = student;
      }
    }

    if (invalidStudents.length) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `Students do not belong to school: ${invalidStudents.join(", ")}`
          )
        );
    }

    // Prevent adding the same student twice to the room (handle ObjectId/string mix)
    const existingIdsSet = new Set(
      (room.studentIds || []).map((id) => id.toString())
    );
    const toAdd = incomingUniqueIds.filter((id) => !existingIdsSet.has(id));
    const skipped = incomingUniqueIds.filter((id) => existingIdsSet.has(id));

    if (toAdd.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { id: room._id, added: [], skipped },
            `No new students to assign; skipped existing students`
          )
        );
    }

    // Merge and save room student IDs (keep unique)
    const mergedIds = Array.from(
      new Set([...(room.studentIds || []).map((id) => id.toString()), ...toAdd])
    );
    room.studentIds = mergedIds;
    room.teacherId = teacherId;
    await room.save();

    // Update only newly added students with new room
    await Promise.all(
      toAdd.map(async (stuId) => {
        await Child.findByIdAndUpdate(
          stuId,
          { roomId: room._id },
          { new: true }
        );
      })
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { id: room._id, added: toAdd, skipped },
          `Students assigned to room successfully`
        )
      );
  } catch (error) {
    console.error(`Error assigning children to room:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const createRoomHandle = async (req, res) => {
  try {
    const { roomNo, schoolId, teacherId, studentIds } = req.body;

    console.log("------------>", req.user);

    const schema = Joi.object({
      roomNo: Joi.string().required(),
      schoolId: Joi.string().required(),
      teacherId: Joi.string().required(),
      studentIds: Joi.array().items(Joi.string()).min(1).optional(),
    });

    // Check if room number already exists in the school
    const existingRoom = await Room.findOne({ roomNo, schoolId });
    if (existingRoom) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `Room number ${roomNo} already exists in this school`
          )
        );
    }

    const { error } = schema.validate(req.body);

    if (error)
      return res
        .status(401)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const school = await School.findOne({ _id: schoolId });

    if (!school)
      return res.status(404).json(new ApiResponse(404, {}, `school not found`));

    const teacher = await Teacher.findOne({ _id: teacherId }).populate(
      "schoolId"
    );
    if (!teacher)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `teacher not found`));

    console.log(teacher);

    if (
      teacher.schoolId._id.toString() !== schoolId ||
      teacher.schoolId.adminId.toString() !== req.user.id
    ) {
      return res
        .status(401)
        .json(new ApiResponse(400, {}, `Unauthorized Access`));
    }

    let validatedStudentIds = [];

    if (studentIds && studentIds.length > 0) {
      const invalidStudents = [];

      for (const id of studentIds) {
        console.log(" ids ---------->", id);
        const student = await Child.findById(id);
        if (!student || student.schoolId.toString() !== schoolId) {
          invalidStudents.push(id);
        }
      }

      if (invalidStudents.length)
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              {},
              `Student does not belong to school: ${invalidStudents.join(", ")}`
            )
          );

      validatedStudentIds = studentIds;
    }

    const data = new Room({
      roomNo,
      schoolId,
      teacherId,
      studentIds: validatedStudentIds,
      createdBy: req.user.id,
    });

    await data.save();

    if (validatedStudentIds.length > 0) {
      await Promise.all(
        validatedStudentIds.map(async (stuId) => {
          await Child.findByIdAndUpdate(
            stuId,
            { roomId: data._id },
            { new: true }
          );
        })
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse(200, { id: data._id }, `room created successfully `)
      );
  } catch (error) {
    console.log(`error while creating room `, error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `Room number ${error.keyValue.roomNo} already exists in this school`
          )
        );
    }
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};
