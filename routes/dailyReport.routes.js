import { Router } from "express";
import {
  getDailyReportHandle,
  updateActivitiesHandle,
  updateHealthHandle,
  updateTemperatureHandle,
  updateMoodHandle,
  updateSuppliesHandle,
  updateNapsHandle,
  updateNotesHandle,
  updateNameToFaceHandle,
  updateMoveRoomsHandle,
  submitDailyReportHandle,
  getChildReportsHandle,
  editActivityHandle,
  editHealthHandle,
  editTemperatureHandle,
  editMoodHandle,
  editSuppliesHandle,
  editNapsHandle,
  editNotesHandle,
  editNameToFaceHandle,
  editMoveRoomsHandle,
} from "../controllers/dailyReportController.js";
import { auth } from "../middlewares/auth.js";
import { multerUpload } from "../utils/customUploader.js";

const dailyReportRouter = Router();

// Get or create today's daily report
dailyReportRouter.get("/report", auth, getDailyReportHandle);

// Update individual fields
// dailyReportRouter.post("/check-in", auth, updateCheckInHandle);
// dailyReportRouter.post("/check-out", auth, updateCheckOutHandle);

//activities
dailyReportRouter.post(
  "/activities",
  auth,
  multerUpload.single("image"),
  updateActivitiesHandle
);
dailyReportRouter.post(
  "/edit-activities",
  auth,
  multerUpload.single("image"),
  editActivityHandle
)

//health
dailyReportRouter.post("/health", auth, updateHealthHandle);
dailyReportRouter.post("/edit-health", auth, editHealthHandle);

//temperature
dailyReportRouter.post("/temperature", auth, updateTemperatureHandle);
dailyReportRouter.post("/edit-temperature", auth, editTemperatureHandle)

//mood
dailyReportRouter.post("/mood", auth, updateMoodHandle);
dailyReportRouter.post("/edit-mood", auth, editMoodHandle)

// editSuppliesHandle
dailyReportRouter.post("/supplies", auth, updateSuppliesHandle);
dailyReportRouter.post("/edit-supplies", auth, editSuppliesHandle);

//naps
dailyReportRouter.post("/naps", auth, updateNapsHandle);
dailyReportRouter.post("/edit-naps", auth, editNapsHandle)

//notes 
dailyReportRouter.post("/notes", auth, updateNotesHandle);
dailyReportRouter.post("/edit-notes", auth, editNotesHandle);

//name to face
dailyReportRouter.post("/name-to-face", auth, updateNameToFaceHandle);
dailyReportRouter.post("/edit-name-to-face", auth, editNameToFaceHandle)

//move rooms
dailyReportRouter.post("/move-rooms", auth, updateMoveRoomsHandle);
dailyReportRouter.post("/edit-move-rooms", auth, editMoveRoomsHandle);


// Submit daily report
dailyReportRouter.post("/submit", auth, submitDailyReportHandle);

// Get all reports for a child
dailyReportRouter.get("/child-reports", auth, getChildReportsHandle);

export default dailyReportRouter;
