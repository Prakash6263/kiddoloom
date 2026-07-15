import mongoose from "mongoose";
import { ChatConversation } from "../models/ChatConversation.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { assertTeacherParentLink } from "../utils/chatAccess.js";

function getUserFromReq(req) {
  const u = req.user || {};
  const id = u.id || u._id || u.userId;
  const role = u.role;
  return { id, role };
}

function makeKey(a, b) {
  const A = `${a.role}:${String(a.userId)}`;
  const B = `${b.role}:${String(b.userId)}`;
  return [A, B].sort().join("|");
}

export async function getOrCreateConversation(req, res) {
  try {
    const me = getUserFromReq(req);
    const otherId = req.body?.otherId;
    const otherRole = req.body?.otherRole; // "teacher" or "parent"

    if (!me.id || !me.role) return res.status(401).json({ message: "Unauthorized" });
    if (!otherId || !otherRole) return res.status(400).json({ message: "otherId and otherRole required" });

    // only teacher-parent
    const roles = [me.role, otherRole].sort().join("-");
    if (roles !== "parent-teacher") return res.status(403).json({ message: "Only teacher-parent chat allowed" });

    const teacherId = me.role === "teacher" ? me.id : otherId;
    const parentId  = me.role === "parent"  ? me.id : otherId;

    const access = await assertTeacherParentLink({ teacherId, parentId });
    if (!access.ok) return res.status(403).json({ message: access.reason });

    const p1 = { userId: new mongoose.Types.ObjectId(me.id), role: me.role };
    const p2 = { userId: new mongoose.Types.ObjectId(otherId), role: otherRole };
    const key = makeKey(p1, p2);

    let convo = await ChatConversation.findOne({ key });
    if (!convo) {
      convo = await ChatConversation.create({ key, participants: [p1, p2] });
    }

    return res.json({ conversationId: convo._id, participants: convo.participants });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: String(e?.message || e) });
  }
}

export async function listMyConversations(req, res) {
  try {
    const me = getUserFromReq(req);
    if (!me.id || !me.role) return res.status(401).json({ message: "Unauthorized" });

    const list = await ChatConversation.find({
      participants: { $elemMatch: { userId: new mongoose.Types.ObjectId(me.id), role: me.role } }
    }).sort({ lastMessageAt: -1, updatedAt: -1 });

    return res.json({ conversations: list });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getConversationMessages(req, res) {
  try {
    const me = getUserFromReq(req);
    const convoId = req.params.id;
    const limit = Math.min(Number(req.query.limit || 50), 200);

    let convo = null;
    if (convoId) {
      if (mongoose.Types.ObjectId.isValid(convoId)) {
        convo = await ChatConversation.findById(convoId);
      }

      if (!convo) {
        convo = await ChatConversation.findOne({ key: convoId });
      }

      if (!convo && convoId.indexOf(":") !== -1) {
        const parts = convoId.split(":").map(s => s.trim()).filter(Boolean);
        if (parts.length === 2 && mongoose.Types.ObjectId.isValid(parts[0]) && mongoose.Types.ObjectId.isValid(parts[1])) {
          const a = new mongoose.Types.ObjectId(parts[0]);
          const b = new mongoose.Types.ObjectId(parts[1]);
          convo = await ChatConversation.findOne({
            $and: [
              { participants: { $elemMatch: { userId: a } } },
              { participants: { $elemMatch: { userId: b } } }
            ]
          });
        }
      }
    }

    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const isMember = convo.participants.some(p => String(p.userId) === String(me.id) && p.role === me.role);
    if (!isMember) return res.status(403).json({ message: "Forbidden" });

    const msgs = await ChatMessage.find({ conversationId: convo._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({ messages: msgs.reverse() });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
}

export async function markConversationRead(req, res) {
  try {
    const me = getUserFromReq(req);
    const convoId = req.params.id;

    let convo = null;
    if (convoId) {
      if (mongoose.Types.ObjectId.isValid(convoId)) {
        convo = await ChatConversation.findById(convoId);
      }
      if (!convo) convo = await ChatConversation.findOne({ key: convoId });
      if (!convo && convoId.indexOf(":") !== -1) {
        const parts = convoId.split(":").map(s => s.trim()).filter(Boolean);
        if (parts.length === 2 && mongoose.Types.ObjectId.isValid(parts[0]) && mongoose.Types.ObjectId.isValid(parts[1])) {
          const a = new mongoose.Types.ObjectId(parts[0]);
          const b = new mongoose.Types.ObjectId(parts[1]);
          convo = await ChatConversation.findOne({
            $and: [
              { participants: { $elemMatch: { userId: a } } },
              { participants: { $elemMatch: { userId: b } } }
            ]
          });
        }
      }
    }

    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const isMember = convo.participants.some(p => String(p.userId) === String(me.id) && p.role === me.role);
    if (!isMember) return res.status(403).json({ message: "Forbidden" });

    await ChatMessage.updateMany(
      { conversationId: convo._id, "to.userId": me.id, "to.role": me.role, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
}
