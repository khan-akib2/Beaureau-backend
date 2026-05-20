import mongoose from "mongoose";

const ChatHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
