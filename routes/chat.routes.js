import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import {
  getOrCreateConversation,
  listMyConversations,
  getConversationMessages,
  markConversationRead,
} from "../controllers/chat.controller.js";

const router = Router();

// otherId = jis se chat karni (teacher ya parent)
router.post("/conversation", auth, getOrCreateConversation);

router.get("/conversations", auth, listMyConversations);
router.get("/conversations/:id/messages", auth, getConversationMessages);
router.post("/conversations/:id/read", auth, markConversationRead);

export default router;
