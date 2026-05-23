import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    phone: { type: String, default: "" },
    avatar: {
      type: String,
      default: function () {
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.name || "Default")}`;
      },
    },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: "" },
    otpExpires: { type: Date },
    language: { type: String, default: "en" },
    emailNotifs: { type: Boolean, default: true },
    smsNotifs: { type: Boolean, default: true },
    appNotifs: { type: Boolean, default: true },
    statusUpdates: { type: Boolean, default: true },
    isAadhaarLinked: { type: Boolean, default: false },
    isDigiLockerLinked: { type: Boolean, default: false },
    aadhaarNum: { type: String, default: "" },
    aadhaarOtp: { type: String, default: "" },
    aadhaarOtpExpires: { type: Date },
    aadhaarData: { type: mongoose.Schema.Types.Mixed, default: null },
    resetOtp: { type: String, default: "" },
    resetOtpExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
