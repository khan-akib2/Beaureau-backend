import express from "express";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import User from "../models/User.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
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

    if (conn.isMock) {
      const db = getMockDb();
      if (db.users.find((u) => u.email === email.toLowerCase())) {
        return res.status(400).json({ error: "A user with this email already exists." });
      }
      const hashedPassword = await hashPassword(password);
      const newUser = {
        _id: "user_" + Math.random().toString(36).substr(2, 9),
        name, email: email.toLowerCase(), password: hashedPassword,
        role: "user",
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);
      saveMockDb(db);
      const token = signToken({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role });
      res.cookie("bureau_token", token, COOKIE_OPTS);
      return res.json({ success: true, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, avatar: newUser.avatar } });
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ error: "A user with this email already exists." });
    }
    const hashedPassword = await hashPassword(password);
    const newUser = await User.create({ name, email: email.toLowerCase(), password: hashedPassword, role: "user" });
    const token = signToken({ id: newUser._id, email: newUser.email, name: newUser.name, role: newUser.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({ success: true, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, avatar: newUser.avatar } });
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

    const token = signToken({ id: user._id || user.id, email: user.email, name: user.name, role: user.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({
      success: true,
      user: {
        id: user._id || user.id, name: user.name, email: user.email, role: user.role,
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
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

    if (conn.isMock) {
      const db = getMockDb();
      user = db.users.find((u) => u._id === req.user.id);
    } else {
      user = await User.findById(req.user.id).select("-password");
    }

    if (!user) return res.status(404).json({ error: "User not found." });

    return res.json({
      success: true,
      user: {
        id: user._id || user.id, name: user.name, email: user.email, role: user.role,
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
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
    const { name, email, phone, password, avatar } = req.body;
    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const idx = db.users.findIndex((u) => u._id === req.user.id);
      if (idx === -1) return res.status(404).json({ error: "User not found." });
      if (name) db.users[idx].name = name;
      if (email) db.users[idx].email = email.toLowerCase();
      if (phone) db.users[idx].phone = phone;
      if (avatar) db.users[idx].avatar = avatar;
      if (password) db.users[idx].password = await hashPassword(password);
      saveMockDb(db);
      const u = db.users[idx];
      return res.json({ success: true, user: { id: u._id, name: u.name, email: u.email, role: u.role, avatar: u.avatar } });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (phone) updates.phone = phone;
    if (avatar) updates.avatar = avatar;
    if (password) updates.password = await hashPassword(password);

    const updated = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    return res.json({ success: true, user: { id: updated._id, name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar } });
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
        user = { _id: "user_" + Math.random().toString(36).substr(2, 9), name, email: email.toLowerCase(), password: "google_sso", role: "user", avatar, createdAt: new Date().toISOString() };
        db.users.push(user);
        saveMockDb(db);
      }
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) user = await User.create({ name, email: email.toLowerCase(), password: "google_sso", role: "user", avatar });
    }

    const token = signToken({ id: user._id || user.id, email: user.email, name: user.name, role: user.role });
    res.cookie("bureau_token", token, COOKIE_OPTS);
    return res.json({ success: true, user: { id: user._id || user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ error: "Google Authentication failed." });
  }
});

export default router;
