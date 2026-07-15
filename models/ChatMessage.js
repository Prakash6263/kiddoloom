import mongoose from "mongoose";

const PartySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["parent", "teacher"], required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },

    from: { type: PartySchema, required: true },
    to: { type: PartySchema, required: true },

    text: { type: String, required: true, trim: true },

    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
