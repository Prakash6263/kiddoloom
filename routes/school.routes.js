import { Router } from "express";
import {
  allSchoolsHandle,
  schoolDetailsHandle,
  allTeachersHandle,
  allchildFormsHandle
} from "../controllers/schoolController.js";
import { upload } from "../middlewares/multer.js";
import { auth } from "../middlewares/auth.js";

const schoolRouter = Router();
schoolRouter.get("/school", allSchoolsHandle);
schoolRouter.get("/my-school", auth, schoolDetailsHandle);
schoolRouter.get("/all-forms", auth, allchildFormsHandle);
schoolRouter.get("/all-teachers", auth, allTeachersHandle)


export default schoolRouter;
