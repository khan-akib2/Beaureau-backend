import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    referenceNumber: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    status: {
      type: String,
      enum: ["submitted", "under_review", "action_required", "approved", "rejected"],
      default: "submitted",
    },
    progress: { type: Number, min: 0, max: 100, default: 10 },
    timeline: {
      type: [
        {
          status: { type: String, required: true },
          description: { type: String, required: true },
          date: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    estimatedCompletion: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Application || mongoose.model("Application", ApplicationSchema);
