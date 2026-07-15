import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { ApiResponse } from "../utils/ApiResponse.js";
import { generateRandomString, getExpirationTime } from "../utils/helpers.js";
import {
  sendForgotPasswordMail,
  sendPasswordMail,
  sendChildAddedMail,
} from "../utils/email.js";
import { Parent } from "../models/parent/Parent.js";
import { uploadFile } from "../utils/customUploader.js";
import { Teacher } from "../models/teacher/Teacher.js";
import { School } from "../models/schools/school.js";
import { Room } from "../models/schools/Room.js";
import { RoomSchedule } from "../models/schools/Schedule.js";
import { Attendance } from "../models/attendence/Attendence.js";
import { Child } from "../models/parent/ChildForm.js";

export const signupHandle = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      roomNo,
      education,
      city,
      address,
      gender,
      schoolId,
    } = req.body;

    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      roomNo: Joi.string(),
      education: Joi.string().required(),
      city: Joi.string().required(),
      address: Joi.string().required(),
      gender: Joi.string().required(),
      schoolId: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const user = await Teacher.findOne({
      $or: [{ email }, { phone }],
    });
    if (user) {
      let msg = email == user.email ? "email" : "phone number";
      return res
        .status(401)
        .json(new ApiResponse(400, {}, `${msg} already exists`));
    }

    const school = await School.findById(schoolId);
    if (!school)
      return res.status(404).json(new ApiResponse(404, {}, `School not found`));

    const randomPassword = await generateRandomString(15);
    const newTeacher = new Teacher({
      name,
      email,
      phone,
      roomNo,
      education,
      city,
      address,
      gender,
      schoolId,
      password: randomPassword,
      role: "teacher",
    });
    await newTeacher.save();

    await sendPasswordMail(name, email, randomPassword);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          newTeacher._id,
          `${name} teacher registered successfully`
        )
      );
  } catch (error) {
    console.error(`Error in signupHandle:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal Server Error`));
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
    const user = await Teacher.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid email or password"));

    if (user.status !== 2) {
      let msg =
        user.status == 1
          ? `your account is not activated yet`
          : `your account is rejected by the school`;
      return res.status(401).json(new ApiResponse(400, {}, `${msg}`));
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Invalid email or password"));

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, schoolId: user.schoolId, role: user.role || "teacher" },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      address: user.address,
      gender: user.gender,
      education: user.education,
      role: user.role || "teacher",
    };

    return res
      .status(200)
      .json(new ApiResponse(200, { userData, token }, `Login successful`));
  } catch (error) {
    console.error(`Error logging in teacher:`, error);
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
    // Find parent by emails
    const user = await Teacher.findOne({ email });
    if (!user)
      return res.status(404).json(new ApiResponse(404, {}, `Parent not found`));

    user.actToken = actToken;
    user.linkExpireAt = linkExpireAt;
    await user.save();

    await sendForgotPasswordMail(
      user.name,
      user.email,
      user.actToken,
      "teachers"
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
      return res.status(400).json(new ApiResponse(400, {}, `Invalid link`));

    // Find parent by activation token
    const user = await Teacher.findOne({ actToken: id });
    if (user) {
      if (user.linkExpireAt < new Date()) {
        return res.render("linkExpired", {
          msg: `Link expired, please request a new one`,
        });
      }
      res.render("forgotTeacherPassword", { msg: "", vertoken: user.actToken });
    } else {
      res.render("forgotTeacherPassword", { msg: `Invalid link` });
    }
  } catch (error) {
    console.error(`Error verifying password:`, error);
    res.render("error", { msg: `Invalid link` });
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
    const user = await Teacher.findOne({ actToken: token });
    if (!user)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Parent not found or invalid token"));

    user.password = newPassword;
    user.actToken = null;

    await user.save();

    res.render("passwordSuccess", { msg: `Password changed successfully` });
  } catch (error) {
    console.error(`Error changing password:`, error);
    res.render(`error`, { msg: `Invalid link` });
  }
};

export const teacherRoomsHandle = async (req, res) => {
  try {
    const { id } = req.query;
    const defaultImage = "https://yourcdn.com/default-profile.png";
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (id) {
      const data = await Room.findOne({ _id: id, teacherId: req.user.id })
        .select("-__v  -schoolId  -createdBy -teacherId")
        .populate({
          path: "studentIds",
          select: "-__v -createdAt -updatedAt -schoolId",
          populate: {
            path: "parentId",
            select: "_id name email",
          },
        });
      if (!data)
        return res.status(404).json(new ApiResponse(404, {}, `room not found`));

      const studentIds = data.studentIds.map((s) => s._id);
      const attendances = await Attendance.find({
        roomId: data._id,
        date: { $in: [today, dateOnly] },
        studentId: { $in: studentIds },
      })
        .select("studentId entryTime exitTime scannedBy")
        .lean();

      const attendanceMap = {};
      attendances.forEach((a) => {
        attendanceMap[a.studentId.toString()] = a;
      });

      const students = data.studentIds.map((s) => {
        const att = attendanceMap[s._id.toString()];
        const studentObj = s.toObject ? s.toObject() : s;
        return {
          ...studentObj,
          profileImage: studentObj.profileImage || defaultImage,
          attendance: att
            ? {
                present: true,
                entryTime: att.entryTime,
                exitTime: att.exitTime,
                scannedBy: att.scannedBy,
              }
            : {
                present: false,
                entryTime: null,
                exitTime: null,
                scannedBy: null,
              },
        };
      });

      const roomPayload = data.toObject
        ? { ...data.toObject(), studentIds: students }
        : { ...data, studentIds: students };

      return res
        .status(200)
        .json(new ApiResponse(200, roomPayload, `Room fetched successfully`));
    }

    const data = await Room.find({ teacherId: req.user.id })
      .select("-__v  -schoolId  -createdBy -teacherId")
      .populate({
        path: "studentIds",
        select: "-__v -createdAt -updatedAt -schoolId",
        populate: {
          path: "parentId",
          select: "_id name email",
        },
      });

    if (!data || data.length == 0) {
      return res.status(404).json(new ApiResponse(404, {}, `rooms not found`));
    }

    const roomIds = data.map((r) => r._id);
    const attendances = await Attendance.find({
      roomId: { $in: roomIds },
      date: { $in: [today, dateOnly] },
    })
      .select("roomId studentId entryTime exitTime scannedBy")
      .lean();

    const attendanceMap = {};
    attendances.forEach((a) => {
      const rid = a.roomId.toString();
      const sid = a.studentId.toString();
      attendanceMap[rid] = attendanceMap[rid] || {};
      attendanceMap[rid][sid] = a;
    });

    const enriched = data.map((room) => {
      const roomObj = room.toObject ? room.toObject() : room;
      const students = roomObj.studentIds.map((s) => {
        const att = (attendanceMap[roomObj._id.toString()] || {})[
          s._id.toString()
        ];
        const studentObj = s.toObject ? s.toObject() : s;
        return {
          ...studentObj,
          profileImage: studentObj.profileImage || defaultImage,
          attendance: att
            ? {
                present: true,
                entryTime: att.entryTime,
                exitTime: att.exitTime,
                scannedBy: att.scannedBy,
              }
            : {
                present: false,
                entryTime: null,
                exitTime: null,
                scannedBy: null,
              },
        };
      });
      return { ...roomObj, studentIds: students };
    });

    return res
      .status(200)
      .json(new ApiResponse(200, enriched, `Rooms fetched successfully`));
  } catch (error) {
    console.error(`Error while getting teachers rooms:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal Server Error`));
  }
};

export const scheduleHandle = async (req, res) => {
  try {
    const { title, description, startTime, date, roomId } = req.body;
    const schema = Joi.object({
      title: Joi.string().required(),
      description: Joi.string().required(),
      startTime: Joi.string().required(),
      date: Joi.string().required(),
      roomId: Joi.string().required(),
    });
    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const teacher = await Teacher.findOne({ _id: req.user.id });
    if (!teacher)
      return res
        .status(400)
        .json(new ApiResponse(404, {}, `teacher does not found`));

    const room = await Room.findOne({ _id: roomId, teacherId: req.user.id });
    if (!room)
      return res
        .status(400)
        .json(
          new ApiResponse(404, {}, `room does not found or room not assigned`)
        );

    console.table([teacher.schoolId.toString(), room.schoolId.toString()]);

    if (teacher.schoolId.toString() !== room.schoolId.toString())
      return res
        .status(400)
        .json(new ApiResponse(404, {}, `Unauthorized access`));

    const newSchedule = await RoomSchedule.create({
      title,
      description,
      startTime,
      date,
      roomId,
      teacherId: req.user.id,
    });
    return res
      .status(200)
      .json(
        new ApiResponse(200, newSchedule._id, `schedule created successfully`)
      );
  } catch (error) {
    console.error(`Error while scheduling:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal Server Error`));
  }
};

export const myScheduleHandle = async (req, res) => {
  try {
    const { roomId } = req.query;

    const schema = Joi.object({
      roomId: Joi.string().required(),
    });
    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const room = await Room.findOne({ _id: roomId });
    if (!room) res.status(400).json(new ApiResponse(400, {}, `room not found`));

    const user = await Teacher.findOne({ _id: req.user.id });
    if (!user)
      res.status(400).json(new ApiResponse(400, {}, `teacher not found`));

    const data = await RoomSchedule.find({
      roomId: roomId,
      teacherId: req.user.id,
    });

    if (!data)
      res.status(400).json(new ApiResponse(400, {}, `No schedule found`));

    if (user.schoolId.toString() !== room.schoolId.toString())
      res.status(400).json(new ApiResponse(400, {}, `Unauthorized access`));

    return res
      .status(200)
      .json(new ApiResponse(200, data, `schedule data fetched successfully`));
  } catch (error) {
    console.error(`Error while getting schedule:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal Server Error`));
  }
};

export const getProfileHandle = async (req, res) => {
  try {
    const user = await Teacher.findById(req.user.id)
      .select("-password -__v -actToken -linkExpireAt")
      .populate({
        path: "schoolId",
        model: School,
        select: "_id name description address contactInfo images principalName",
      });

    if (!user)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Teacher not found`));

    const room = await Room.find({ teacherId: req.user.id }).select(
      "-__v -schoolId -createdBy -createdAt -studentIds -teacherId"
    );

    let defaultRoom = null;
    if (user.defaultRoomId) {
      defaultRoom = await Room.findById(user.defaultRoomId).select(
        "-__v -schoolId -createdBy -createdAt -studentIds -teacherId"
      );
    }

    const payload = {
      user,
      room: room || null,
      defaultRoom: defaultRoom || null,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, payload, `Teacher profile fetched successfully`)
      );
  } catch (error) {
    console.error(`Error while fetching teacher profile:`, error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Internal Server Error`));
  }
};

export const setDefaultRoomHandle = async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, "roomId is required"));
    }
    const room = await Room.findOne({ _id: roomId, teacherId: req.user.id });
    if (!room) {
      return res
        .status(404)
        .json(
          new ApiResponse(404, {}, "Room not found or not assigned to you")
        );
    }
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Teacher not found"));
    }
    teacher.defaultRoomId = roomId;
    await teacher.save();
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Default room set successfully"));
  } catch (error) {
    console.error("Error setting default room:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const updateProfileHandle = async (req, res) => {
  try {
    const { name, phone, city, address, education, skills } = req.body;

    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100),
      phone: Joi.string(),
      city: Joi.string(),
      address: Joi.string(),
      education: Joi.string(),
      skills: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().custom((value, helpers) => {
          if (typeof value === "string") {
            return value.split(",").map((s) => s.trim());
          }
          return value;
        })
      ),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));
    }

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Teacher not found"));
    }

    if (name) teacher.name = name;
    if (phone) teacher.phone = phone;
    if (city) teacher.city = city;
    if (address) teacher.address = address;
    if (education) teacher.education = education;
    if (skills) {
      teacher.skills = Array.isArray(skills)
        ? skills
        : skills.split(",").map((s) => s.trim());
    }

    if (req.files && req.files.length > 0) {
      try {
        const file = req.files[0];
        const { uploadFile } = await import("../utils/customUploader.js");
        const imageUrl = await uploadFile(file, {
          folder: "profile-images",
          useS3: true,
          deleteLocal: true,
        });
        teacher.profileImage = imageUrl;
      } catch (uploadError) {
        console.error("Error uploading profile image:", uploadError);
        return res
          .status(500)
          .json(new ApiResponse(500, {}, "Error uploading profile image"));
      }
    }

    await teacher.save();

    const updatedTeacher = {
      id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      city: teacher.city,
      address: teacher.address,
      gender: teacher.gender,
      education: teacher.education,
      skills: teacher.skills,
      profileImage: teacher.profileImage,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedTeacher, "Profile updated successfully")
      );
  } catch (error) {
    console.error("Error updating profile:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const getByIdStudentHandle = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, "studentId is required"));
    }
    const room = await Room.findOne({
      teacherId: req.user.id,
      studentIds: studentId,
    });
    if (!room) {
      return res
        .status(404)
        .json(
          new ApiResponse(404, {}, "Student not found in your assigned rooms")
        );
    }

    const student = await Child.findById(studentId)
      .select("-__v")
      .populate({
        path: "parentId",
        select: "_id name email phone address",
      })
      .populate({
        path: "schoolId",
        select: "_id name address contactInfo",
      })
      .populate({
        path: "roomId",
        select: "_id roomName",
      });

    if (!student) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Student details not found"));
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendances = await Attendance.find({
      studentId: studentId,
      roomId: room._id,
      date: { $in: [today, dateOnly] },
    })
      .select("studentId date entryTime exitTime scannedBy")
      .populate({ path: "scannedBy", select: "_id name email" })
      .lean();

    let attendance = null;
    if (attendances && attendances.length) {
      attendance =
        attendances.find((a) => a.date === today) ||
        attendances.find(
          (a) =>
            a.date && new Date(a.date).toISOString().split("T")[0] === today
        ) ||
        attendances[0];
    }

    const studentObj = student.toObject ? student.toObject() : student;
    studentObj.attendance = attendance
      ? {
          present: true,
          date: attendance.date,
          entryTime: attendance.entryTime,
          exitTime: attendance.exitTime,
          scannedBy: attendance.scannedBy || null,
        }
      : {
          present: false,
          date: today,
          entryTime: null,
          exitTime: null,
          scannedBy: null,
        };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          studentObj,
          "Student full details fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching student by ID:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const teacherAddChildHandle = async (req, res) => {
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
      roomId,
    } = req.body;

    const schema = Joi.object({
      name: Joi.string().required(),
      age: Joi.string().required(),
      parentName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      emergencyContact: Joi.string().required(),
      address: Joi.string().required(),
      notes: Joi.string().optional(),
      schoolId: Joi.string().optional(),
      roomId: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, `Teacher not found`));

    // determine school
    const targetSchoolId = schoolId || teacher.schoolId;

    // find or create parent
    let parent = await Parent.findOne({ $or: [{ email }, { phone }] });
    let createdNewParent = false;
    if (!parent) {
      const randomPassword = await generateRandomString(15);
      parent = new Parent({
        name: parentName,
        email,
        phone,
        password: randomPassword,
      });
      await parent.save();
      // send initial password mail
      await sendPasswordMail(parentName, email, randomPassword);
      createdNewParent = true;
    } else {
      // notify existing parent that a child was added
      const school = await School.findById(targetSchoolId);
      try {
        await sendChildAddedMail(
          parent.name,
          parent.email,
          name,
          teacher.name,
          school?.name || null
        );
      } catch (mailErr) {
        console.error(
          "Failed to send child-added mail to existing parent:",
          mailErr
        );
      }
    }

    // check duplicate child for this parent and school
    const childExists = await Child.findOne({
      name: name,
      age: age,
      email: email,
      parentId: parent._id,
      schoolId: targetSchoolId,
    });

    if (childExists)
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            {},
            `A form for this child already exists for this parent and school.`
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

    const newChild = new Child({
      name,
      age,
      parentName,
      email,
      phone,
      emergencyContact,
      address,
      notes,
      parentId: parent._id,
      schoolId: targetSchoolId,
      roomId: roomId || null,
      image: imageUrl,
    });

    await newChild.save();

    // if room provided, and teacher owns the room, add student id to room
    if (roomId) {
      const room = await Room.findOne({ _id: roomId, teacherId: req.user.id });
      if (room) {
        room.studentIds = room.studentIds || [];
        room.studentIds.push(newChild._id);
        await room.save();
      }
    }

    // Send notification if parent was newly created (already sent) or if we want an extra notification for existing
    if (createdNewParent) {
      const school = await School.findById(targetSchoolId);
      try {
        await sendChildAddedMail(
          parent.name,
          parent.email,
          name,
          teacher.name,
          school?.name || null
        );
      } catch (mailErr) {
        console.error(
          "Failed to send child-added mail to new parent:",
          mailErr
        );
      }
    }

    return res
      .status(201)
      .json(
        new ApiResponse(201, { child: newChild }, `Child added successfully`)
      );
  } catch (error) {
    console.error("Error teacher adding child:", error);
    return res
      .status(501)
      .json(new ApiResponse(500, {}, `Internal server error`));
  }
};
