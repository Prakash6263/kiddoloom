import { Router } from "express";
 import {auth} from "../middlewares/auth.js"
import {
    registerHandle,
    loginHandle,
    fogotPasswordHandle,
    verifyPasswordHandle,
    changePasswordHandle,
    addChildHandle,
    myChildHandle,
    markAttendenceHandle,
    childAttendanceHandle
}  from "../controllers/parentController.js";
import { multerUpload } from "../utils/customUploader.js";
import { getChildReportsByParent } from "../controllers/dailyReportController.js";

const parenRouter = Router()

parenRouter.post("/register", registerHandle);
parenRouter.post("/login", loginHandle);
parenRouter.post("/forgot-password", fogotPasswordHandle);
parenRouter.get("/verify-password/:id", verifyPasswordHandle);
parenRouter.post("/change-password", changePasswordHandle);
parenRouter.post("/child", auth, multerUpload.single("image"), addChildHandle)
parenRouter.get("/child", auth, myChildHandle)
parenRouter.post("/child/attendance", auth, markAttendenceHandle)
parenRouter.get("/child/attendance", auth, childAttendanceHandle)
parenRouter.get("/child/daily-reports", auth, getChildReportsByParent)



export default parenRouter;