import mongoose from "mongoose";

const ChatHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Compatible with both ObjectId and mock user ID strings
    title: { type: String, default: "New Conversation" },
    messages: {
      type: [
        {
          role: { type: String, enum: ["user", "model"], required: true },
          content: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.ChatHistory || mongoose.model("ChatHistory", ChatHistorySchema);
