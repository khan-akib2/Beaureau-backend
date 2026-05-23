import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dbConnect, { getMockDb } from "./db.js";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "bureauai_super_secret_jwt_key_987654321";

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hashedPassword) {
  if (!hashedPassword || typeof hashedPassword !== "string" || !hashedPassword.startsWith("$2")) {
    return false;
  }
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Express middleware — reads JWT from httpOnly cookie or Authorization header.
 * Attaches decoded payload to req.user. Returns 401 if missing/invalid.
 */
export function requireAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token && req.cookies?.bureau_token) {
    token = req.cookies.bureau_token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized session." });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie("bureau_token", { path: "/" });
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  // Reject mock session tokens
  if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
    return res.status(401).json({ error: "Invalid mock session. Please log in again." });
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware — same as requireAuth but also checks role === "admin".
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const conn = await dbConnect();
      const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
      let user = null;
      if (conn.isMock || !isRealObjectId) {
        const db = getMockDb();
        user = db.users.find((u) => u._id === req.user.id);
      } else {
        user = await User.findById(req.user.id);
      }

      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access. Admins only." });
      }

      req.user.role = user.role; // sync database role
      next();
    } catch (err) {
      console.error("requireAdmin db check error:", err);
      return res.status(500).json({ error: "Internal server error." });
    }
  });
}
