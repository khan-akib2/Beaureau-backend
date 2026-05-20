import mongoose from "mongoose";

const UploadedDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    summary: { type: String, default: "" },
    suggestions: { type: [String], default: [] },
    missingRequirements: { type: [String], default: [] },
    status: { type: String, enum: ["verified", "incomplete", "pending"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.models.UploadedDocument || mongoose.model("UploadedDocument", UploadedDocumentSchema);
