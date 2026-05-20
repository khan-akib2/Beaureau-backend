import mongoose from "mongoose";

const EligibilityCheckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    inputs: {
      age: { type: Number, required: true },
      income: { type: Number, required: true },
      occupation: { type: String, required: true },
      location: { type: String, required: true },
      category: { type: String, required: true },
    },
    results: {
      type: [
        {
          schemeName: { type: String, required: true },
          department: { type: String, required: true },
          description: { type: String, required: true },
          matchScore: { type: Number, default: 90 },
          benefits: { type: String, required: true },
          applyUrl: { type: String, default: "#" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.EligibilityCheck || mongoose.model("EligibilityCheck", EligibilityCheckSchema);
