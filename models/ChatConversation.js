import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["parent", "teacher"], required: true },
  },
  { _id: false }
);

const ChatConversationSchema = new mongoose.Schema(
  {
    // unique key to avoid duplicate conversation
    key: { type: String, required: true, unique: true },

    participants: { type: [ParticipantSchema], required: true },

    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChatConversationSchema.index({ "participants.userId": 1 });

export const ChatConversation = mongoose.model("ChatConversation", ChatConversationSchema);
