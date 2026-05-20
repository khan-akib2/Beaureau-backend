import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "bureauai_super_secret_jwt_key_987654321";

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hashedPassword) {
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
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware — same as requireAuth but also checks role === "admin".
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized access. Admins only." });
    }
    next();
  });
}
