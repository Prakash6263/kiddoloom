import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { format } from "date-fns";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { generateQR } from "../utils/helpers.js";

import { Parent } from "../models/parent/Parent.js";
import { Room } from "../models/schools/Room.js";
import { Child } from "../models/parent/ChildForm.js";
import { Attendance } from "../models/attendence/Attendence.js";
import { uploadFile } from "../utils/customUploader.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateRandomString, getExpirationTime } from "../utils/helpers.js";
import { sendPasswordMail, sendForgotPasswordMail } from "../utils/email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const registerHandle = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

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
    const existingParent = await Parent.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingParent) {
      let msg = email == existingParent.email ? "email" : "phone number";
      return res
        .status(401)
        .json(new ApiResponse(400, {}, `${msg} already exists`));
    }

    const randomPassword = await generateRandomString(15);

    // Create new parent
    const newParent = new Parent({
      name,
      email,
      phone,
      password: randomPassword,
      role: "parent",
    });
    await newParent.save();

    // Send password via email
    await sendPasswordMail(name, email, randomPassword);

    return res
      .status(201)
      .json(new ApiResponse(201, {}, "Parent registered successfully"));
  } catch (error) {
    console.error("Error registering parent:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const loginHandle = async (req, res) => {
  try {
    const { email, password } = req.body;

    let flag;

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
    const parent = await Parent.findOne({ email });
    if (!parent)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid email or password"));

    const isValidPassword = await bcrypt.compare(password, parent.password);
    if (!isValidPassword)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid email or password"));

    // Generate JWT token
    const token = jwt.sign(
      { id: parent._id, email: parent.email, role: parent.role || "parent" },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );
    const findParent = await Child.findOne({ parentId: parent._id });

    if (!findParent) {
      flag = false;
    } else {
      flag = true;
    }

    const userData = {
      id: parent._id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      role: parent.role || "parent",
      isChild: flag,
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

export const fogotPasswordHandle = async (req, res) => {
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
    const parent = await Parent.findOne({ email });
    if (!parent)
      return res.status(404).json(new ApiResponse(404, {}, "Parent not found"));

    parent.actToken = actToken;
    parent.linkExpireAt = linkExpireAt;
    await parent.save();

    await sendForgotPasswordMail(
      parent.name,
      parent.email,
      parent.actToken,
      "parents"
    );

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password reset link sent to your email"));
  } catch (error) {
    console.error("Error in forgot password:", error);
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
    const parent = await Parent.findOne({ actToken: id });
    if (parent) {
      if (parent.linkExpireAt < new Date()) {
        return res.render("linkExpired", {
          msg: "Link expired, please request a new one",
        });
      }
      res.render("forgotPassword", { msg: "", vertoken: parent.actToken });
    } else {
      res.render("forgotPassword", { msg: "Invalid link" });
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
    const parent = await Parent.findOne({ actToken: token });
    if (!parent)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Parent not found or invalid token"));

    parent.password = newPassword;
    parent.actToken = null;

    await parent.save();

    res.render("passwordSuccess", { msg: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.render("error", { msg: "Invalid link" });
  }
};

export const addChildHandle = async (req, res) => {
  try {
    const {
      name,
      age,
      parentName,
      email,
      phone,
      emergencyContact,
      address,
      notes,
      schoolId,
    } = req.body;
    const schema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().required(),
      parentName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      emergencyContact: Joi.string().required(),
      address: Joi.string().required(),
      notes: Joi.string().optional(),
      schoolId: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const parent = await Parent.findOne({ _id: req.user.id });
    if (!parent || parent._id.toString() !== req.user.id)
      return res.status(404).json(new ApiResponse(404, {}, `Parent not found`));
    const childExists = await Child.findOne({
      name: name,
      age: age,
      email: email,
      parentId: req.user.id,
      schoolId: schoolId,
    });

    if (childExists)
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `You’ve already submitted a form for this child to this school.`
          )
        );

    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadFile(req.file, { folder: "childs" });
      } catch (err) {
        console.error("Error uploading image:", err);
        return res
          .status(500)
          .json(new ApiResponse(500, {}, `Image upload failed`));
      }
    }

    // Create new child (including optional image URL)
    const newChild = new Child({
      name,
      age,
      parentName,
      email,
      phone,
      emergencyContact,
      address,
      notes,
      parentId: req.user.id,
      schoolId,
      image: imageUrl,
    });

    await newChild.save();

    return res
      .status(201)
      .json(
        new ApiResponse(201, { child: newChild }, `Child added successfully`)
      );
  } catch (error) {
    console.error("Error adding child:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const myChildHandle = async (req, res) => {
  try {
    const { id } = req.query;
    if (id) {
      const data = await Child.findOne({
        _id: id,
        parentId: req.user.id,
      }).select(" -__v -createdAt -updatedAt");
      if (!data)
        return res
          .status(404)
          .json(new ApiResponse(404, {}, `child not found`));

      let parseData = data.toObject();
      if (data.roomId) {
        const childData = {
          id: data._id.toString(),
          room: data.roomId,
          school: data.schoolId.toString(),
        };
        const QR = await generateQR(childData);

        parseData.qrCode = QR;
        const roomInfo = await Room.findById(data.roomId).populate(
          "teacherId",
          "name"
        );
        parseData.teacherId = roomInfo ? roomInfo.teacherId?._id.toString() : null;
        parseData.teacherName = roomInfo ? roomInfo.teacherId?.name || null : null;
      }

      return res
        .status(200)
        .json(new ApiResponse(200, parseData, `child fetched successfully`));
    }

    const data = await Child.find({ parentId: req.user.id }).select(
      "-createdAt -updatedAt  -__v"
    );

    if (!data || data.length == 0)
      return res.status(404).json(new ApiResponse(404, {}, `Child not found`));

    // const QRCode = await Promise.all(
    //   data.map(async (item) => {
    //     if (item.roomId) {
    //       const childData = {
    //         id: item._id.toString(),
    //         room: item.roomId ? item.roomId.toString() : item.roomId,
    //         school: item.schoolId.toString(),
    //       };

    //       return await generateQR(childData);
    //     }
    //   })
    // );

    const parsedData = await Promise.all(
      data.map(async (child) => {
        const childObj = child.toObject();

        if (child.roomId) {
          const childData = {
            id: child._id.toString(),
            room: child.roomId.toString(),
            school: child.schoolId?.toString() || null,
          };
          const QR = await generateQR(childData);
          childObj.qrCode = QR;
          const roomInfo = await Room.findById(child.roomId).populate(
            "teacherId",
            "name"
          );
          childObj.teacherId = roomInfo ? roomInfo.teacherId?._id.toString() : null;
          childObj.teacherName = roomInfo ? roomInfo.teacherId?.name || null : null;
        }

        return childObj;
      })
    );

    return res
      .status(200)
      .json(new ApiResponse(200, parsedData, `Childs fetched successfully`));
  } catch (error) {
    console.error("Error getting child:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const markAttendenceHandle = async (req, res) => {
  try {
    const { student, room, school } = req.body;

    const schema = Joi.object({
      student: Joi.string().required(),
      room: Joi.string().required(),
      school: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const child = await Child.findOne({
      _id: student,
      roomId: room,
      schoolId: school,
    });

    console.log(`child ---->`, req.user.id);

    if (!child)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Invalid QR code or student not found`));

    const roomData = await Room.findOne({
      _id: room,
      teacherId: req.user.id,
    });

    if (!roomData)
      return res
        .status(403)
        .json(new ApiResponse(403, {}, `You are not authorized for this room`));
    const today = new Date();
    const dateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    let attendance = await Attendance.findOne({
      studentId: student,
      roomId: room,
      date: dateOnly,
    });

    if (!attendance) {
      attendance = new Attendance({
        studentId: student,
        roomId: room,
        schoolId: school,
        date: dateOnly,
        entryTime: today,
      });
    } else if (!attendance.exitTime) {
      attendance.exitTime = today;
      attendance.scannedBy = req.user.id;
    } else {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, "Attendance already completed"));
    }

    await attendance.save();

    return res
      .status(200)
      .json(new ApiResponse(200, attendance, "Attendance marked successfully"));
  } catch (error) {
    console.error(`Error while marking attendence:`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};

export const childAttendanceHandle = async (req, res) => {
  try {
    const { id } = req.query;
    const child = await Child.findOne({ _id: id, parentId: req.user.id });
    if (!child)
      return res
        .status(404)
        .json(
          new ApiResponse(404, {}, `child not found or unauthorized access`)
        );

    const data = await Attendance.find({ studentId: id })
      .select("-__v -createdAt -updatedAt")
      .populate("studentId", "_id name age parentName")
      .populate("schoolId", "_id name")
      .populate("scannedBy", "_id name");

    if (!data || data.length == 0)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `attendance not found`));
    const formattedData = data.map((r) => {
      const obj = r.toObject();
      return {
        ...obj,
        date: format(new Date(obj.date), "d-M-yyyy,"),
        entryTime: format(new Date(obj.entryTime), "d-M-yyyy, h:mm:ss a"),
        exitTime: format(new Date(obj.exitTime), "d-M-yyyy, h:mm:ss a"),
      };
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, formattedData, `attedance fetched successfully`)
      );
  } catch (error) {
    console.error(`Error while getting attendence:`, error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};
