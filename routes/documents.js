import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import UploadedDocument from "../models/UploadedDocument.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../lib/auth.js";
import { analyzeDocument } from "../lib/gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Multer — store uploads in /uploads folder, 10 MB limit
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/documents
router.get("/", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    let documents = [];

    if (conn.isMock) {
      const db = getMockDb();
      documents = req.user.role === "admin" ? db.uploadedDocuments : db.uploadedDocuments.filter((d) => d.userId === req.user.id);
    } else {
      documents = req.user.role === "admin"
        ? await UploadedDocument.find({}).sort({ createdAt: -1 })
        : await UploadedDocument.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }

    res.json({ success: true, documents });
  } catch (err) {
    console.error("GET Documents Error:", err);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
});

// POST /api/documents  — accepts either a real file upload OR JSON metadata
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    // Support both multipart (real file) and JSON (metadata-only from frontend)
    const fileName = req.file?.originalname || req.body.fileName;
    const fileSize = req.file?.size || Number(req.body.fileSize);
    const fileType = req.file?.mimetype || req.body.fileType;
    const fileUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.fileUrl || `https://source.unsplash.com/random/800x600/?document&sig=${Date.now()}`;

    if (!fileName || !fileSize || !fileType) {
      return res.status(400).json({ error: "File metadata is incomplete." });
    }

    const analysis = await analyzeDocument(fileName, fileType);
    const conn = await dbConnect();
    let newDoc = null;

    if (conn.isMock) {
      const db = getMockDb();
      newDoc = { _id: "doc_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, fileName, fileSize, fileType, fileUrl, summary: analysis.summary, suggestions: analysis.suggestions, missingRequirements: analysis.missingRequirements, status: analysis.status, createdAt: new Date().toISOString() };
      db.uploadedDocuments.push(newDoc);
      db.notifications.push({ _id: "notif_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, title: `Document Uploaded: ${fileName}`, message: `Status: ${analysis.status.toUpperCase()}`, type: analysis.status === "verified" ? "success" : "warning", read: false, createdAt: new Date().toISOString() });
      saveMockDb(db);
    } else {
      newDoc = await UploadedDocument.create({ userId: req.user.id, fileName, fileSize, fileType, fileUrl, summary: analysis.summary, suggestions: analysis.suggestions, missingRequirements: analysis.missingRequirements, status: analysis.status });
      await Notification.create({ userId: req.user.id, title: `Document Uploaded: ${fileName}`, message: `Status: ${analysis.status.toUpperCase()}`, type: analysis.status === "verified" ? "success" : "warning" });
    }

    res.json({ success: true, document: newDoc });
  } catch (err) {
    console.error("POST Document Error:", err);
    res.status(500).json({ error: "Failed to upload and analyze document." });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await dbConnect();

    if (conn.isMock) {
      const db = getMockDb();
      const before = db.uploadedDocuments.length;
      db.uploadedDocuments = db.uploadedDocuments.filter((d) => !(d._id === id && (d.userId === req.user.id || req.user.role === "admin")));
      if (db.uploadedDocuments.length === before) return res.status(404).json({ error: "Document not found or unauthorized." });
      saveMockDb(db);
    } else {
      const query = req.user.role === "admin" ? { _id: id } : { _id: id, userId: req.user.id };
      const deleted = await UploadedDocument.findOneAndDelete(query);
      if (!deleted) return res.status(404).json({ error: "Document not found or unauthorized." });
    }

    res.json({ success: true, message: "Document deleted." });
  } catch (err) {
    console.error("DELETE Document Error:", err);
    res.status(500).json({ error: "Failed to delete document." });
  }
});

export default router;
