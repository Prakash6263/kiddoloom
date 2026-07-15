import { Router } from "express";
import { auth, isSuperAdmin } from "../middlewares/auth.js";


import {
    addAdminHandle,
  
} from "../controllers/superAdminController.js";



const superAdminRouter = Router();
superAdminRouter.post("/admin", auth, isSuperAdmin, addAdminHandle)



export default superAdminRouter;