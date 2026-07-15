import {Router} from "express";
import {
     addSchoolHandle,
        loginHandle,
    forgotPasswordHandle,
    verifyPasswordHandle,
    changePasswordHandle,
    teacherStatusUpdate,
    createRoomHandle,
    childStatusUpdate,
    assignChildrenToRoom
}
from "../controllers/adminController.js"

import { multerUpload } from "../utils/customUploader.js";
import { auth, isSuperAdmin , isAdmin} from "../middlewares/auth.js";


const adminRouter = Router();

adminRouter.post("/school", auth, multerUpload.array("images"), addSchoolHandle);
adminRouter.post("/login", loginHandle);
adminRouter.post("/forgot-password", forgotPasswordHandle);
adminRouter.get("/verify-password/:id", verifyPasswordHandle);
adminRouter.post("/change-password", changePasswordHandle);
adminRouter.post("/teacher/status", auth, teacherStatusUpdate )
adminRouter.post("/child/status", auth, childStatusUpdate )
adminRouter.post("/room", auth, createRoomHandle)
adminRouter.post("/room/assign-children", auth, assignChildrenToRoom)




export default adminRouter;