import { Router } from "express";
import {
  signupHandle,
  loginHandle,
  fogotPasswordHandle,
  verifyPasswordHandle,
  changePasswordHandle,
  teacherRoomsHandle,
  scheduleHandle,
  myScheduleHandle,
  getProfileHandle,
  setDefaultRoomHandle,
  updateProfileHandle,
  getByIdStudentHandle,
  teacherAddChildHandle,
} from "../controllers/teacherController.js";
import { auth } from "../middlewares/auth.js";
import { multerUpload } from "../utils/customUploader.js";


const teacherRouter = Router();

teacherRouter.post("/register", signupHandle);
teacherRouter.post("/login", loginHandle);
teacherRouter.post("/forgot-password", fogotPasswordHandle);
teacherRouter.get("/verify-password/:id", verifyPasswordHandle);
teacherRouter.post("/change-password", changePasswordHandle);
teacherRouter.get("/get-profile", auth, getProfileHandle);
teacherRouter.post("/update-profile", auth, multerUpload.array("profileImage"), updateProfileHandle);
teacherRouter.get("/rooms", auth, teacherRoomsHandle);
teacherRouter.post("/schedule", auth, scheduleHandle);
teacherRouter.get("/schedule", auth, myScheduleHandle)
teacherRouter.post("/set-default-room", auth, setDefaultRoomHandle);
teacherRouter.get("/child-by-id", auth, getByIdStudentHandle);
teacherRouter.post("/child", auth, multerUpload.single("image"), teacherAddChildHandle);

export default teacherRouter;
