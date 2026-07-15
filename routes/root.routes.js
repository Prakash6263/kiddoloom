import { Router } from "express";
import schoolRouter from "./school.routes.js";
import parenRouter from "./parent.routes.js";
import superAdminRouter from "./superAdmin.routes.js";
import adminRouter from "./admin.routes.js";
import teacherRouter from "./teacher.routes.js";
import dailyReportRouter from "./dailyReport.routes.js";
import chatRoutes from "./chat.routes.js";


const rootRouter = Router()

rootRouter.use("/schools", schoolRouter);
rootRouter.use("/parents", parenRouter);
rootRouter.use("/admin", adminRouter)
rootRouter.use("/super-admin", superAdminRouter);
rootRouter.use("/teachers", teacherRouter);
rootRouter.use("/daily-reports", dailyReportRouter);
rootRouter.use("/chat", chatRoutes);

export default rootRouter;