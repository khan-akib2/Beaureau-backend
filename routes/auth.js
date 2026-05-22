import express from "express";
import mongoose from "mongoose";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import User from "../models/User.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";
import { sendOtpEmail, sendAadhaarOtpEmail } from "../lib/email.js";

const router = express.Router();


const COOKIE_OPTS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: "/",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const conn = await dbConnect();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (conn.isMock) {
      const db = getMockDb();
      const existingUser = db.users.find((u) => u.email === email.toLowerCase());
      if (existingUser && existingUser.isVerified !== false) {
        return res.status(400).json({ error: "A user with this email already exists." });
      }
      
      const hashedPassword = await hashPassword(password);
      if (existingUser) {
        existingUser.name = name;
        existingUser.password = hashedPassword;
        existingUser.otp = otp;
        existingUser.otpExpires = otpExpires.toISOString();
        existingUser.isVerified = false;
      } else {
        const newUser = {
          _id: "user_" + Math.random().toString(36).substr(2, 9),
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: "user",
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          createdAt: new Date().toISOString(),
          isVerified: false,
          otp,
          otpExpires: otpExpires.toISOString(),
        };
        db.users.push(newUser);
      }
      saveMockDb(db);
      await sendOtpEmail(email.toLowerCase(), name, otp);
      return res.json({
        success: true,
        message: "Verification code sent to email.",
        email: email.toLowerCase()
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && existingUser.isVerified !== false) {
      return res.status(400).json({ error: "A user with this email already exists." });
    }

    const hashedPassword = await hashPassword(password);
    if (existingUser) {
      existingUser.name = name;
      existingUser.password = hashedPassword;
      existingUser.otp = otp;
      existingUser.otpExpires = otpExpires;
      existingUser.isVerified = false;
      await existingUser.save();
    } else {
      await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "user",
        isVerified: false,
        otp,
        otpExpires,
      });
    }

    await sendOtpEmail(email.toLowerCase(), name, otp);
    return res.json({
      success: true,
      message: "Verification code sent to email.",
      email: email.toLowerCase()
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const conn = await dbConnect();
    let user = null;

    if (conn.isMock) {
      const db = getMockDb();
      user = db.users.find((u) => u.email === email.toLowerCase());
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password." });

    // Handle email verification block
    if (user.isVerified === false) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      
      if (conn.isMock) {
        const db = getMockDb();
        const idx = db.users.findIndex((u) => u.email === email.toLowerCase());
        db.users[idx].otp = otp;
        db.users[idx].otpExpires = otpExpires.toISOString();
        saveMockDb(db);
      } else {
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();
      }

      await sendOtpEmail(user.email, user.name, otp);

      return res.status(400).json({
        error: "Your email address is unverified. A new verification code has been sent.",
        requiresVerification: true,
        email: user.email
      });
    }

    const token = signToken({ id: user._id || user.id, email: user.email, name: user.name, role: user.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({
      success: true,
      token,
      user: {
        id: user._id || user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone || "",
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and code are required." });

    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const user = db.users.find((u) => u.email === email.toLowerCase());
      if (!user) return res.status(404).json({ error: "User not found." });

      const dbOtpExpires = new Date(user.otpExpires).getTime();
      if (user.otp !== otp || dbOtpExpires < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }

      user.isVerified = true;
      user.otp = "";
      saveMockDb(db);

      const token = signToken({ id: user._id, email: user.email, name: user.name, role: user.role });
      res.cookie("bureau_token", token, COOKIE_OPTS);
      return res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.otp !== otp || user.otpExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    user.isVerified = true;
    user.otp = "";
    await user.save();

    const token = signToken({ id: user._id, email: user.email, name: user.name, role: user.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const conn = await dbConnect();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (conn.isMock) {
      const db = getMockDb();
      const user = db.users.find((u) => u.email === email.toLowerCase());
      if (!user) return res.status(404).json({ error: "User not found." });
      if (user.isVerified === true) return res.status(400).json({ error: "Email is already verified." });

      user.otp = otp;
      user.otpExpires = otpExpires.toISOString();
      saveMockDb(db);

      await sendOtpEmail(user.email, user.name, otp);
      return res.json({
        success: true,
        message: "Verification code resent."
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.isVerified === true) return res.status(400).json({ error: "Email is already verified." });

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendOtpEmail(user.email, user.name, otp);
    return res.json({
      success: true,
      message: "Verification code resent."
    });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("bureau_token", { path: "/" });
  res.json({ success: true, message: "Successfully logged out." });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    let user = null;

    // If ID is not a valid MongoDB ObjectId (e.g. mock string like 'user_demo_123'),
    // always use the mock DB lookup regardless of connection state.
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      user = db.users.find((u) => u._id === req.user.id);
    } else {
      user = await User.findById(req.user.id).select("-password");
    }

    if (!user) {
      res.clearCookie("bureau_token", { path: "/" });
      return res.status(404).json({ error: "User not found." });
    }

    let token = null;
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (!token && req.cookies?.bureau_token) {
      token = req.cookies.bureau_token;
    }
    if (!token || req.user.role !== user.role) {
      token = signToken({ id: user._id || user.id, email: user.email, name: user.name, role: user.role });
      res.cookie("bureau_token", token, COOKIE_OPTS);
    }

    return res.json({
      success: true,
      token,
      user: {
        id: user._id || user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone || "",
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
        language: user.language || "en",
        isVerified: user.isVerified || false,
        emailNotifs: user.emailNotifs !== undefined ? user.emailNotifs : true,
        smsNotifs: user.smsNotifs !== undefined ? user.smsNotifs : true,
        appNotifs: user.appNotifs !== undefined ? user.appNotifs : true,
        statusUpdates: user.statusUpdates !== undefined ? user.statusUpdates : true,
        isAadhaarLinked: user.isAadhaarLinked || false,
        isDigiLockerLinked: user.isDigiLockerLinked || false,
        aadhaarNum: user.aadhaarNum || "",
        aadhaarData: user.aadhaarData || null,
      },
    });
  } catch (err) {
    console.error("Auth Me Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /api/auth/me  — update profile
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const {
      name, email, phone, password, avatar, language,
      emailNotifs, smsNotifs, appNotifs, statusUpdates,
      isAadhaarLinked, isDigiLockerLinked
    } = req.body;

    if (password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters." });
      }
    }

    const conn = await dbConnect();

    // Guard: if the token carries a non-ObjectId ID (old mock token), use mock DB.
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      const idx = db.users.findIndex((u) => u._id === req.user.id);
      if (idx === -1) return res.status(404).json({ error: "User not found." });
      if (name) db.users[idx].name = name;
      if (email) db.users[idx].email = email.toLowerCase();
      if (phone) db.users[idx].phone = phone;
      if (avatar) db.users[idx].avatar = avatar;
      if (language) db.users[idx].language = language;
      if (emailNotifs !== undefined) db.users[idx].emailNotifs = emailNotifs;
      if (smsNotifs !== undefined) db.users[idx].smsNotifs = smsNotifs;
      if (appNotifs !== undefined) db.users[idx].appNotifs = appNotifs;
      if (statusUpdates !== undefined) db.users[idx].statusUpdates = statusUpdates;
      if (isAadhaarLinked !== undefined) db.users[idx].isAadhaarLinked = isAadhaarLinked;
      if (isDigiLockerLinked !== undefined) db.users[idx].isDigiLockerLinked = isDigiLockerLinked;
      if (password) db.users[idx].password = await hashPassword(password);
      saveMockDb(db);
      const u = db.users[idx];
      return res.json({
        success: true,
        user: {
          id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone || "",
          avatar: u.avatar, language: u.language || "en", isVerified: u.isVerified || false,
          emailNotifs: u.emailNotifs !== undefined ? u.emailNotifs : true,
          smsNotifs: u.smsNotifs !== undefined ? u.smsNotifs : true,
          appNotifs: u.appNotifs !== undefined ? u.appNotifs : true,
          statusUpdates: u.statusUpdates !== undefined ? u.statusUpdates : true,
          isAadhaarLinked: u.isAadhaarLinked || false,
          isDigiLockerLinked: u.isDigiLockerLinked || false,
          aadhaarNum: u.aadhaarNum || "",
          aadhaarData: u.aadhaarData || null,
        }
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (phone) updates.phone = phone;
    if (avatar) updates.avatar = avatar;
    if (language) updates.language = language;
    if (emailNotifs !== undefined) updates.emailNotifs = emailNotifs;
    if (smsNotifs !== undefined) updates.smsNotifs = smsNotifs;
    if (appNotifs !== undefined) updates.appNotifs = appNotifs;
    if (statusUpdates !== undefined) updates.statusUpdates = statusUpdates;
    if (isAadhaarLinked !== undefined) updates.isAadhaarLinked = isAadhaarLinked;
    if (isDigiLockerLinked !== undefined) updates.isDigiLockerLinked = isDigiLockerLinked;
    if (password) updates.password = await hashPassword(password);

    const updated = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { returnDocument: 'after' }).select("-password");
    if (!updated) return res.status(404).json({ error: "User not found in database." });
    return res.json({
      success: true,
      user: {
        id: updated._id, name: updated.name, email: updated.email, role: updated.role, phone: updated.phone || "",
        avatar: updated.avatar, language: updated.language || "en", isVerified: updated.isVerified || false,
        emailNotifs: updated.emailNotifs !== undefined ? updated.emailNotifs : true,
        smsNotifs: updated.smsNotifs !== undefined ? updated.smsNotifs : true,
        appNotifs: updated.appNotifs !== undefined ? updated.appNotifs : true,
        statusUpdates: updated.statusUpdates !== undefined ? updated.statusUpdates : true,
        isAadhaarLinked: updated.isAadhaarLinked || false,
        isDigiLockerLinked: updated.isDigiLockerLinked || false,
        aadhaarNum: updated.aadhaarNum || "",
        aadhaarData: updated.aadhaarData || null,
      }
    });
  } catch (err) {
    console.error("PATCH Me Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential, email: providedEmail, name: providedName, picture } = req.body;
    let email = providedEmail, name = providedName, avatar = picture;

    if (credential) {
      try {
        const base64Url = credential.split(".")[1];
        const payload = JSON.parse(Buffer.from(base64Url.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        email = payload.email; name = payload.name; avatar = payload.picture;
      } catch (e) { console.error("Google credential decode error:", e); }
    }

    if (!email) return res.status(400).json({ error: "Google verification email details missing." });
    name = name || email.split("@")[0];
    avatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    const conn = await dbConnect();
    let user = null;

    if (conn.isMock) {
      const db = getMockDb();
      user = db.users.find((u) => u.email === email.toLowerCase());
      if (!user) {
        user = { _id: "user_" + Math.random().toString(36).substr(2, 9), name, email: email.toLowerCase(), password: "google_sso", role: "user", avatar, createdAt: new Date().toISOString(), isVerified: true };
        db.users.push(user);
        saveMockDb(db);
      } else {
        if (user.isVerified !== true) {
          user.isVerified = true;
          user.otp = "";
          saveMockDb(db);
        }
      }
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        user = await User.create({ name, email: email.toLowerCase(), password: "google_sso", role: "user", avatar, isVerified: true });
      } else {
        if (user.isVerified !== true) {
          user.isVerified = true;
          user.otp = "";
          await user.save();
        }
      }
    }

    const token = signToken({ id: user._id || user.id, email: user.email, name: user.name, role: user.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({ success: true, token, user: { id: user._id || user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ error: "Google Authentication failed." });
  }
});

// POST /api/auth/make-admin  — dev utility: promote any user to admin by email
// Remove this route before going to production
router.post("/make-admin", async (req, res) => {
  try {
    const { email, secret } = req.body;
    if (secret !== (process.env.ADMIN_SECRET || "bureau-admin-2026")) {
      return res.status(403).json({ error: "Invalid secret." });
    }
    if (!email) return res.status(400).json({ error: "Email is required." });

    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const idx = db.users.findIndex((u) => u.email === email.toLowerCase());
      if (idx === -1) return res.status(404).json({ error: "User not found." });
      db.users[idx].role = "admin";
      saveMockDb(db);
      return res.json({ success: true, message: `${email} is now an admin.` });
    }

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { role: "admin" } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ success: true, message: `${email} is now an admin.` });
  } catch (err) {
    console.error("Make Admin Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Verhoeff Algorithm Tables
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function validateAadhaar(aadhaarNum) {
  const cleanStr = aadhaarNum.replace(/\s+/g, "");
  if (cleanStr.length !== 12 || !/^\d+$/.test(cleanStr)) {
    return false;
  }
  // Bypass/allow the demo card proposed in the implementation plan
  if (cleanStr === "365892059182") {
    return true;
  }
  let c = 0;
  cleanStr.split("").reverse().forEach((digit, i) => {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][parseInt(digit, 10)]];
  });
  return c === 0;
}

// POST /api/auth/aadhaar/send-otp
router.post("/aadhaar/send-otp", requireAuth, async (req, res) => {
  try {
    const { aadhaarNum } = req.body;
    if (!aadhaarNum) {
      return res.status(400).json({ error: "Aadhaar number is required." });
    }

    const cleanAadhaar = aadhaarNum.replace(/\s+/g, "");
    if (cleanAadhaar.length !== 12 || !/^\d+$/.test(cleanAadhaar)) {
      return res.status(400).json({ error: "Aadhaar number must be exactly 12 digits." });
    }

    // Verhoeff validation
    const isValidAadhaar = validateAadhaar(cleanAadhaar);
    if (!isValidAadhaar) {
      return res.status(400).json({ error: "Invalid Aadhaar number (checksum validation failed)." });
    }

    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let user = null;
    let email = "";
    let name = "";

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      const userIdx = db.users.findIndex((u) => u._id === req.user.id);
      if (userIdx === -1) {
        return res.status(404).json({ error: "User not found." });
      }
      db.users[userIdx].aadhaarNum = cleanAadhaar;
      db.users[userIdx].aadhaarOtp = otp;
      db.users[userIdx].aadhaarOtpExpires = otpExpires.toISOString();
      saveMockDb(db);
      user = db.users[userIdx];
      email = user.email;
      name = user.name;
    } else {
      user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      user.aadhaarNum = cleanAadhaar;
      user.aadhaarOtp = otp;
      user.aadhaarOtpExpires = otpExpires;
      await user.save();
      email = user.email;
      name = user.name;
    }

    // Send styled Aadhaar OTP Email
    await sendAadhaarOtpEmail(email, name, otp, cleanAadhaar);

    return res.json({
      success: true,
      message: "OTP sent to your registered mobile/email."
    });
  } catch (err) {
    console.error("Aadhaar Send OTP Error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/auth/aadhaar/verify-otp
router.post("/aadhaar/verify-otp", requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: "Verification code (OTP) is required." });
    }

    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let user = null;

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      const userIdx = db.users.findIndex((u) => u._id === req.user.id);
      if (userIdx === -1) {
        return res.status(404).json({ error: "User not found." });
      }
      user = db.users[userIdx];
    } else {
      user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
    }

    if (!user.aadhaarOtp || user.aadhaarOtp !== otp) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    const expires = new Date(user.aadhaarOtpExpires);
    if (expires.getTime() < Date.now()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    const rawAadhaar = user.aadhaarNum;
    const maskedAadhaar = "XXXX XXXX " + rawAadhaar.slice(-4);

    // Generate demographic details
    const mockAadhaarName = user.name.toUpperCase();
    const mockGender = user.name.toLowerCase().includes("khanak") || user.email.toLowerCase().includes("khanak") ? "FEMALE" : "MALE";
    const mockDob = "12/04/1995";
    const mockAddress = "H No 142/A, Gali No 4, Block B, Vikas Nagar, Uttam Nagar, West Delhi, Delhi - 110059";
    const mockPhoto = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=b6e3f4`;
    const mockQrData = `UIDAI:Aadhaar:${rawAadhaar}:${mockAadhaarName}:${mockDob}:${mockGender}:${mockAddress}`;

    const aadhaarData = {
      name: mockAadhaarName,
      dob: mockDob,
      gender: mockGender,
      address: mockAddress,
      photo: mockPhoto,
      qrData: mockQrData,
      rawAadhaar: rawAadhaar,
    };

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      const userIdx = db.users.findIndex((u) => u._id === req.user.id);
      db.users[userIdx].isAadhaarLinked = true;
      db.users[userIdx].aadhaarNum = maskedAadhaar;
      db.users[userIdx].aadhaarOtp = "";
      db.users[userIdx].aadhaarData = aadhaarData;
      saveMockDb(db);
      user = db.users[userIdx];
    } else {
      user.isAadhaarLinked = true;
      user.aadhaarNum = maskedAadhaar;
      user.aadhaarOtp = "";
      user.aadhaarData = aadhaarData;
      await user.save();
    }

    return res.json({
      success: true,
      message: "Aadhaar linked successfully.",
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        avatar: user.avatar,
        language: user.language || "en",
        isVerified: user.isVerified || false,
        emailNotifs: user.emailNotifs !== undefined ? user.emailNotifs : true,
        smsNotifs: user.smsNotifs !== undefined ? user.smsNotifs : true,
        appNotifs: user.appNotifs !== undefined ? user.appNotifs : true,
        statusUpdates: user.statusUpdates !== undefined ? user.statusUpdates : true,
        isAadhaarLinked: true,
        isDigiLockerLinked: user.isDigiLockerLinked || false,
        aadhaarNum: maskedAadhaar,
        aadhaarData: aadhaarData,
      }
    });
  } catch (err) {
    console.error("Aadhaar Verify OTP Error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
