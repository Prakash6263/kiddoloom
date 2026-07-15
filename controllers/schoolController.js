import { School } from "../models/schools/school.js";
import { Child } from "../models/parent/ChildForm.js";
import { Admin } from "../models/admin/Admin.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Teacher } from "../models/teacher/Teacher.js";
import Joi from "joi";
import { Room } from "../models/schools/Room.js";

export const allSchoolsHandle = async (req, res) => {
  try {
    const {id}  = req.query;
 
    if (id) {
      const data = await School.findOne({_id: id})
        .select("-__v -createdAt -updatedAt")
        .sort({ createdAt: -1 });
 
      console.log(" ---------->", data);
 
      data.images.map((img)=>{
        img.url = img.url
          ? `${process.env.Image_URL}/schools/${img.url}`
          : `${process.env.DEFAULT_PIC}`
      })
 
 
      return res
        .status(200)
        .json(new ApiResponse(200, data, "Schools fetched successfully"));
    }
 
    const data = await School.find({ status: { $in: [1, 2] } })
      .select("-__v -createdAt -updatedAt")
      .sort({ createdAt: -1 });
 
    console.log(" ---------->", data);
 
    data.map((item) => {
      item.images.map((img) => {
        img.url = img.url
          ? `${img.url}`
          : `${process.env.DEFAULT_PIC}`;
      });
    });
 
    return res
      .status(200)
      .json(new ApiResponse(200, data, "Schools fetched successfully"));
  } catch (error) {
    console.error("Error fetching schools:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const allchildFormsHandle = async (req, res) => {
  try {
    const { id, schoolId } = req.body;
    const schema = Joi.object({
      id: Joi.string().allow("").optional(),
      schoolId: Joi.string().optional(),
    });

    const { error } = schema.validate({ id, schoolId });
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const user = await Admin.findOne({ _id: req.user.id });
    if (!user)
      return res.status(404).json(new ApiResponse(404, {}, `User not found`));

    const school = await School.findOne({
      _id: schoolId,
      adminId: req.user.id,
    });
    if (!school)
      return res.status(404).json(new ApiResponse(404, {}, `School not found`));

    if (id) {
      const childForm = await Child.findOne({
        _id: id,
        schoolId: schoolId,
      }).select("-__v -createdAt -updatedAt -actToken -linkExpireAt");

      if (!childForm) {
        return res
          .status(404)
          .json(new ApiResponse(404, {}, "No child form found "));
      }

      return res
        .status(200)
        .json(
          new ApiResponse(200, childForm, "Child form fetched successfully")
        );
    }

    const childForms = await Child.find({ schoolId: schoolId }).select(
      "-__v -createdAt -updatedAt -actToken -linkExpireAt"
    );

    if (!childForms || childForms.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `No child forms found`));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, childForms, `Child forms fetched successfully`)
      );
  } catch (error) {
    console.error(`Error fetching child forms:`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const schoolDetailsHandle = async (req, res) => {
  try {
    const school = await School.findOne({ adminId: req.user.id }).select(
      "-__v -createdAt -updatedAt"
    );

    if (!school) {
      return res.status(404).json(new ApiResponse(404, {}, `School not found`));
    }

    school.images.map((img) => {
      img.url = img.url
        ? `${process.env.Image_URL}/schools/${img.url}`
        : `${process.env.DEFAULT_PIC}`;
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, school, `School details fetched successfully`)
      );
  } catch (error) {
    console.error("Error fetching school details:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const allTeachersHandle = async (req, res) => {
  try {
    const { id, schoolId } = req.query;

    const schema = Joi.object({
      id: Joi.string().allow("").optional(),
      schoolId: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const user = await Admin.findOne({ _id: req.user.id });
    if (!user)
      return res.status(404).json(new ApiResponse(404, {}, `User not found`));
    const school = await School.findOne({
      _id: schoolId,
      adminId: req.user.id,
    })
    if (!school)
      return res.status(404).json(new ApiResponse(404, {}, `School not found`));

    if (id) {
      const teacher = await Teacher.findOne({
        _id: id,
        schoolId: schoolId,
      }).select("-__v -createdAt -updatedAt -password -actToken -linkExpireAt");

      if (!teacher)
        return res
          .status(404)
          .json(new ApiResponse(404, {}, `Teacher not found`));

      return res
        .status(200)
        .json(new ApiResponse(200, teacher, `Teacher fetched successfully`));
    }

    const teachers = await Teacher.find({ schoolId: schoolId }).select("-__v -createdAt -updatedAt -password -actToken -linkExpireAt");

    if (!teachers || teachers.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `No teachers found`));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, teachers, `Teachers fetched successfully`));
  } catch (error) {
    console.error(`Error fetching teachers:`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const getRoomsHandle = async (req, res) => {
  const { id, schoolId } = req.body;

  const schema = Joi.object({
    id: Joi.string().allow("").optional(),
    schoolId: Joi.string().optional(),
  });

  const { error } = schema.validate({ id, schoolId });
  if (error)
    return res
      .status(400)
      .json(new ApiResponse(400, {}, error.details[0].message));

  const school = await School.findOne({ _id: schoolId, adminId: req.user.id });
  if (!school)
    return res
      .status(401)
      .json(new ApiResponse(400, {}, `school not found or unauthorized`));

  if (id) {
    const data = await Room.findOne({ _id: id })
      .select("-__v -createdAt -updatedAt")
      .populate(
        "teacherId",
        "-password -actToken -linkExpireAt -createdAt -updatedAt -__v -schoolId"
      )
      .populate("schoolId", "-createdAt -updatedAt -__v -adminId")
      .populate({
        path: "studentIds",
        select: "-createdAt -updatedAt -__v -schoolId",
        populate: {
          path: "parentId",
          select: "name email phone",
        },
      })
      .populate("createdBy", "-password -actToken -linkExpireAt -createdAt -updatedAt -__v")

      data.schoolId.images.map((img)=>{
        img.url = img.url ? `${process.env.BASE_URL}/schools/${img.url}`: `${process.env.DEFAULT_PIC}`
      })
    if (!data)
      return res.status(404).json(new ApiResponse(404, {}, `No room found`));

    return res
      .status(201)
      .json(new ApiResponse(200, data, `room fetched successfully`));
  }

  const data = await Room.find({ schoolId: schoolId })
    .select("-__v -createdAt -updatedAt")
    .populate(
      "teacherId",
      "-password -actToken -linkExpireAt -createdAt -updatedAt -__v -schoolId"
    )
    .populate("schoolId", "-createdAt -updatedAt -__v -adminId")
    .populate({
      path: "studentIds",
      select: "-createdAt -updatedAt -__v -schoolId",
      populate: {
        path: "parentId",
        select: "name email phone",
      },
    })
    .populate("createdBy", "-password -actToken -linkExpireAt -createdAt -updatedAt -__v")

    data.map((item)=>{
      item.schoolId.images.map((img)=>{
        img.url = img.url ? `${process.env.BASE_URL}/schools/${img.url}`: `${process.env.DEFAULT_PIC}`
      })
    })

  if (!data || data.length <= 0)
    return res.status(404).json(new ApiResponse(404, {}, `No rooms found`));

  return res
    .status(201)
    .json(new ApiResponse(200, data, `rooms fetched successfully`));
};
