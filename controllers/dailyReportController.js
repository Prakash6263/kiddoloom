import Joi from "joi";
import { DailyReport } from "../models/parent/DailyReport.js";
import { Child } from "../models/parent/ChildForm.js";
import { Room } from "../models/schools/Room.js";
import { Teacher } from "../models/teacher/Teacher.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadFile } from "../utils/customUploader.js";

// Create or Get today's daily report
export const getDailyReportHandle = async (req, res) => {
  try {
    const { childId, roomId, date } = req.query;
    const schema = Joi.object({
      childId: Joi.string().required(),
      roomId: Joi.string().required(),
      date: Joi.date().optional(),
    });

    const { error } = schema.validate(req.query);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    // Verify child
    const child = await Child.findById(childId);
    if (!child)
      return res.status(404).json(new ApiResponse(404, {}, "Child not found"));

    // Verify room & teacher
    const room = await Room.findOne({
      _id: roomId,
      teacherId: req.user.id,
    });

    if (!room)
      return res
        .status(404)
        .json(
          new ApiResponse(404, {}, "Room not found or not assigned to you")
        );

    // 👉 Date logic
    const reportDate = date
      ? new Date(date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    let report = await DailyReport.findOne({
      childId,
      roomId,
      date: reportDate,
    });

    // Sirf aaj ki date par hi naya report create ho
    if (!report && !date) {
      report = await DailyReport.create({
        childId,
        roomId,
        teacherId: req.user.id,
        date: reportDate,
      });
    }

    if (!report)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Report not found"));

    return res
      .status(200)
      .json(
        new ApiResponse(200, report, "Daily report retrieved successfully")
      );
  } catch (error) {
    console.error("Error getting daily report:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


// ----------------------Update Activities----------------------
export const updateActivitiesHandle = async (req, res) => {
  try {
    const { reportId, activities, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      activities: Joi.string().required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    // Handle optional image upload (field name: 'image')
    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadFile(req.file, { folder: "daily-reports" });
      } catch (err) {
        console.error("Image upload failed:", err);
        return res
          .status(500)
          .json(new ApiResponse(500, {}, "Image upload failed"));
      }
    }

    report.activities.push({
      content: activities,
      time: time || null,
      customField: customField || "",
      image: imageUrl || null,
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Activities updated successfully"));
  } catch (error) {
    console.error("Error updating activities:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editActivityHandle = async (req, res) => {
  try {
    const { reportId, activityId, activities, time, customField } = req.body;
    const schema = Joi.object({
      reportId: Joi.string().required(),
      activityId: Joi.string().required(),
      activities: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const activity = report.activities.id(activityId);
    if (!activity)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Activity not found"));

    if (typeof activities !== "undefined") activity.content = activities;
    if (typeof time !== "undefined") activity.time = time || null;
    if (typeof customField !== "undefined") activity.customField = customField || "";
    // Handle optional image update
    if (req.file) {
      try {
        const imageUrl = await uploadFile(req.file, { folder: "daily-reports" });
        activity.image = imageUrl || "";
      } catch (err) {
        console.error("Image upload failed during edit:", err);
        return res
          .status(500)
          .json(new ApiResponse(500, {}, "Image upload failed"));
      }
    }
    activity.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, activity, "Activity updated successfully"));
  } catch (err) {
    console.error("Error editing activity:", err);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


//---------------------- Update Health---------------------------
export const updateHealthHandle = async (req, res) => {
  try {
    const { reportId, health, customField, time } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      health: Joi.string().required(),
      customField: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.health.push({
      content: health,
      customField: customField || "",
      time: time || null,
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Health updated successfully"));
  } catch (error) {
    console.error("Error updating health:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editHealthHandle = async (req, res) => {
  try {
    const { reportId, healthId, health, customField, time } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      healthId: Joi.string().required(),
      health: Joi.string().optional().allow(""),
      customField: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const healthItem = report.health.id(healthId);
    if (!healthItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Health item not found"));

    // Update fields only if provided
    if (typeof health !== "undefined") healthItem.content = health;
    if (typeof customField !== "undefined")
      healthItem.customField = customField || "";
    if (typeof time !== "undefined") healthItem.time = time || null;

    healthItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, healthItem, "Health updated successfully"));
  } catch (error) {
    console.error("Error editing health:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};



// ------------------------Update Temperature---------------
export const updateTemperatureHandle = async (req, res) => {
  try {
    const { reportId, value, unit, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      value: Joi.number().required(),
      unit: Joi.string().valid("C", "F").required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.temperature.push({
      value: value,
      unit: unit,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Temperature updated successfully"));
  } catch (error) {
    console.error("Error updating temperature:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editTemperatureHandle = async (req, res) => {
  try {
    const { reportId, temperatureId, value, unit, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      temperatureId: Joi.string().required(),
      value: Joi.number().optional(),
      unit: Joi.string().valid("C", "F").optional(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const temperatureItem = report.temperature.id(temperatureId);
    if (!temperatureItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Temperature record not found"));

    // Update only provided fields  
    if (typeof value !== "undefined") temperatureItem.value = value;
    if (typeof unit !== "undefined") temperatureItem.unit = unit;
    if (typeof time !== "undefined") temperatureItem.time = time || null;
    if (typeof customField !== "undefined")
      temperatureItem.customField = customField || "";

    temperatureItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          temperatureItem,
          "Temperature updated successfully"
        )
      );
  } catch (error) {
    console.error("Error editing temperature:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


// ----------------------- Update Mood------------------------
export const updateMoodHandle = async (req, res) => {
  try {
    const { reportId, mood, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      mood: Joi.string()
        .valid("Happy", "Sad", "Angry", "Excited", "Calm", "Neutral")
        .required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.mood.push({
      content: mood,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Mood updated successfully"));
  } catch (error) {
    console.error("Error updating mood:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editMoodHandle = async (req, res) => {
  try {
    const { reportId, moodId, mood, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      moodId: Joi.string().required(),
      mood: Joi.string()
        .valid("Happy", "Sad", "Angry", "Excited", "Calm", "Neutral")
        .optional(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const moodItem = report.mood.id(moodId);
    if (!moodItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Mood record not found"));

    // Update fields only if provided  
    if (typeof mood !== "undefined") moodItem.content = mood;
    if (typeof time !== "undefined") moodItem.time = time || null;
    if (typeof customField !== "undefined")
      moodItem.customField = customField || "";

    moodItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, moodItem, "Mood updated successfully"));
  } catch (error) {
    console.error("Error editing mood:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


//--------------------- Update Supplies------------------------
export const updateSuppliesHandle = async (req, res) => {
  try {
    const { reportId, supplies, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      supplies: Joi.string().required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.supplies.push({
      content: supplies,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Supplies updated successfully"));
  } catch (error) {
    console.error("Error updating supplies:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editSuppliesHandle = async (req, res) => {
  try {
    const { reportId, suppliesId, supplies, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      suppliesId: Joi.string().required(),
      supplies: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const suppliesItem = report.supplies.id(suppliesId);
    if (!suppliesItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Supply record not found"));

    // Update fields only if provided
    if (typeof supplies !== "undefined") suppliesItem.content = supplies;
    if (typeof time !== "undefined") suppliesItem.time = time || null;
    if (typeof customField !== "undefined")
      suppliesItem.customField = customField || "";

    suppliesItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, suppliesItem, "Supplies updated successfully"));
  } catch (error) {
    console.error("Error editing supplies:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


//--------------------- Update Naps----------------------------------------------
export const updateNapsHandle = async (req, res) => {
  try {
    const { reportId, naps, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      naps: Joi.string().required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.naps.push({
      content: naps,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Naps updated successfully"));
  } catch (error) {
    console.error("Error updating naps:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editNapsHandle = async (req, res) => {
  try {
    const { reportId, napsId, naps, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      napsId: Joi.string().required(),
      naps: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const napsItem = report.naps.id(napsId);
    if (!napsItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Nap record not found"));

    // Update only provided fields
    if (typeof naps !== "undefined") napsItem.content = naps;
    if (typeof time !== "undefined") napsItem.time = time || null;
    if (typeof customField !== "undefined")
      napsItem.customField = customField || "";

    napsItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, napsItem, "Naps updated successfully"));
  } catch (error) {
    console.error("Error editing naps:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


//-------------------- Update Notes-----------------------------------------------
export const updateNotesHandle = async (req, res) => {
  try {
    const { reportId, notes, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      notes: Joi.string().required(),
      customField: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.notes.push({
      content: notes,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Notes updated successfully"));
  } catch (error) {
    console.error("Error updating notes:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editNotesHandle = async (req, res) => {
  try {
    const { reportId, notesId, notes, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      notesId: Joi.string().required(),
      notes: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const notesItem = report.notes.id(notesId);
    if (!notesItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Note record not found"));

    // Update only provided fields
    if (typeof notes !== "undefined") notesItem.content = notes;
    if (typeof time !== "undefined") notesItem.time = time || null;
    if (typeof customField !== "undefined")
      notesItem.customField = customField || "";

    notesItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, notesItem, "Notes updated successfully"));
  } catch (error) {
    console.error("Error editing notes:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


// -------------------Update Name to Face-------------------------------------------
export const updateNameToFaceHandle = async (req, res) => {
  try {
    const { reportId, nameToFace, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      nameToFace: Joi.string().required(),
      customField: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.nameToFace.push({
      content: nameToFace,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Name to face updated successfully"));
  } catch (error) {
    console.error("Error updating name to face:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editNameToFaceHandle = async (req, res) => {
  try {
    const { reportId, nameToFaceId, nameToFace, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      nameToFaceId: Joi.string().required(),
      nameToFace: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const nameToFaceItem = report.nameToFace.id(nameToFaceId);
    if (!nameToFaceItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Name-to-face record not found"));

    // Update only provided fields
    if (typeof nameToFace !== "undefined") nameToFaceItem.content = nameToFace;
    if (typeof time !== "undefined") nameToFaceItem.time = time || null;
    if (typeof customField !== "undefined")
      nameToFaceItem.customField = customField || "";

    nameToFaceItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, nameToFaceItem, "Name to face updated successfully")
      );
  } catch (error) {
    console.error("Error editing name to face:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


//--------------------- Update Move Rooms--------------------------------------------
export const updateMoveRoomsHandle = async (req, res) => {
  try {
    const { reportId, moveRooms, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      moveRooms: Joi.string().required(),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.moveRooms.push({
      content: moveRooms,
      time: time || null,
      customField: customField || "",
      createdAt: new Date(),
    });
    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Move rooms updated successfully"));
  } catch (error) {
    console.error("Error updating move rooms:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

export const editMoveRoomsHandle = async (req, res) => {
  try {
    const { reportId, moveRoomsId, moveRooms, time, customField } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
      moveRoomsId: Joi.string().required(),
      moveRooms: Joi.string().optional().allow(""),
      time: Joi.string().optional().allow(null),
      customField: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });

    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    const moveRoomsItem = report.moveRooms.id(moveRoomsId);
    if (!moveRoomsItem)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Move rooms record not found"));

    // Update only provided fields
    if (typeof moveRooms !== "undefined") moveRoomsItem.content = moveRooms;
    if (typeof time !== "undefined") moveRoomsItem.time = time || null;
    if (typeof customField !== "undefined")
      moveRoomsItem.customField = customField || "";

    moveRoomsItem.updatedAt = new Date();

    await report.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, moveRoomsItem, "Move rooms updated successfully")
      );
  } catch (error) {
    console.error("Error editing move rooms:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};


// Submit Daily Report
export const submitDailyReportHandle = async (req, res) => {
  try {
    const { reportId } = req.body;

    const schema = Joi.object({
      reportId: Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const report = await DailyReport.findOne({
      _id: reportId,
      teacherId: req.user.id,
    });
    if (!report)
      return res.status(404).json(new ApiResponse(404, {}, "Report not found"));

    report.isSubmitted = true;
    await report.save();

    return res
      .status(200)
      .json(
        new ApiResponse(200, report, "Daily report submitted successfully")
      );
  } catch (error) {
    console.error("Error submitting daily report:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

// Get all reports for a child
export const getChildReportsHandle = async (req, res) => {
  try {
    const { childId } = req.query;

    const schema = Joi.object({
      childId: Joi.string().required(),
    });

    const { error } = schema.validate(req.query);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const reports = await DailyReport.find({
      childId,
      teacherId: req.user.id,
    }).sort({ date: -1 });

    if (!reports || reports.length === 0)
      return res.status(404).json(new ApiResponse(404, {}, "No reports found"));

    const arrayFields = [
      "activities",
      "health",
      "temperature",
      "mood",
      "supplies",
      "naps",
      "notes",
      "nameToFace",
      "moveRooms",
    ];

    const normalizeItem = (item) => {
      if (!item || typeof item !== "object") return item;

      // Collect numeric keys ("0","1",...)
      const numericKeys = Object.keys(item).filter((k) => /^\d+$/.test(k));
      if (numericKeys.length === 0) return item;

      numericKeys.sort((a, b) => Number(a) - Number(b));
      const reconstructed = numericKeys.map((k) => item[k]).join("");

      // create a shallow copy preserving non-numeric keys
      const copy = { ...item };
      // remove numeric keys
      numericKeys.forEach((k) => delete copy[k]);
      // set content field (consistent with schema)
      copy.content = reconstructed;
      return copy;
    };

    const normalized = reports.map((r) => {
      const rep = r.toObject ? r.toObject() : { ...r };
      arrayFields.forEach((f) => {
        if (Array.isArray(rep[f])) {
          rep[f] = rep[f].map((it) => normalizeItem(it));
        }
      });
      return rep;
    });

    return res
      .status(200)
      .json(new ApiResponse(200, normalized, "Reports retrieved successfully"));
  } catch (error) {
    console.error("Error getting reports:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};

// Get Child Resports by Parent for Today
export const getChildReportsByParent = async (req, res) => {
  try {
    const { childId } = req.query;

    const schema = Joi.object({
      childId: Joi.string().required(),
    });

    const { error } = schema.validate(req.query);
    if (error)
      return res
        .status(400)
        .json(new ApiResponse(400, {}, error.details[0].message));

    const child = await Child.findById(childId);
    if (!child)
      return res.status(404).json(new ApiResponse(404, {}, "Child not found"));

    if (child.parentId && child.parentId.toString() !== req.user.id)
      return res
        .status(401)
        .json(new ApiResponse(401, {}, "Unauthorized access"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const reports = await DailyReport.find({
      childId,
      date: { $gte: today, $lt: tomorrow },
    }).sort({ date: -1 });

    if (!reports || reports.length === 0)
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "No reports found for today"));

    return res
      .status(200)
      .json(
        new ApiResponse(200, reports, "Today's reports retrieved successfully")
      );
  } catch (error) {
    console.error("Error getting today's reports for parent:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Internal Server Error"));
  }
};
