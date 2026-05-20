import express from "express";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import ChatHistory from "../models/ChatHistory.js";
import EligibilityCheck from "../models/EligibilityCheck.js";
import { requireAuth } from "../lib/auth.js";
import { chatWithGemini, translateLegalText, checkEligibility } from "../lib/gemini.js";

const router = express.Router();

// ── Chat ──────────────────────────────────────────────────────────────────────

// POST /api/ai/chat
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, message } = req.body;
    if (!messages && !message) {
      return res.status(400).json({ error: "Messages payload is required." });
    }

    const conversation = messages?.length > 0
      ? messages
      : [{ role: "user", content: message }];

    const responseText = await chatWithGemini(conversation);

    const conn = await dbConnect();
    const newUserMsg = conversation[conversation.length - 1];

    if (conn.isMock) {
      const db = getMockDb();
      let history = db.chatHistories.find((c) => c.userId === req.user.id);
      if (!history) {
        history = { _id: "chat_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, messages: [], createdAt: new Date().toISOString() };
        db.chatHistories.push(history);
      }
      history.messages.push(
        { role: newUserMsg.role, content: newUserMsg.content, timestamp: newUserMsg.timestamp || new Date().toISOString() },
        { role: "model", content: responseText, timestamp: new Date().toISOString() }
      );
      history.updatedAt = new Date().toISOString();
      saveMockDb(db);
    } else {
      await ChatHistory.findOneAndUpdate(
        { userId: req.user.id },
        { $push: { messages: [{ role: newUserMsg.role, content: newUserMsg.content }, { role: "model", content: responseText }] } },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, response: responseText });
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: "AI failed to respond." });
  }
});

// GET /api/ai/chat  — fetch history
router.get("/chat", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    let history = null;

    if (conn.isMock) {
      const db = getMockDb();
      history = db.chatHistories.find((c) => c.userId === req.user.id);
    } else {
      history = await ChatHistory.findOne({ userId: req.user.id });
    }

    res.json({ success: true, messages: history ? history.messages : [] });
  } catch (err) {
    console.error("GET Chat History Error:", err);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

// ── Translate ─────────────────────────────────────────────────────────────────

// POST /api/ai/translate
router.post("/translate", requireAuth, async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !language) {
      return res.status(400).json({ error: "Text and target language are required." });
    }

    const translation = await translateLegalText(text, language);
    res.json({ success: true, translation });
  } catch (err) {
    console.error("Translation Error:", err);
    res.status(500).json({ error: "Failed to translate text." });
  }
});

// ── Eligibility ───────────────────────────────────────────────────────────────

// POST /api/ai/eligibility
router.post("/eligibility", requireAuth, async (req, res) => {
  try {
    const { age, income, occupation, location, category } = req.body;
    if (!age || income === undefined || !occupation || !location || !category) {
      return res.status(400).json({ error: "All profile fields are required." });
    }

    const inputs = { age: Number(age), income: Number(income), occupation, location, category };
    const results = await checkEligibility(inputs);

    const conn = await dbConnect();
    if (conn.isMock) {
      const db = getMockDb();
      db.eligibilityChecks.push({ _id: "check_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, inputs, results, createdAt: new Date().toISOString() });
      saveMockDb(db);
    } else {
      await EligibilityCheck.create({ userId: req.user.id, inputs, results });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("Eligibility Error:", err);
    res.status(500).json({ error: "Failed to evaluate eligibility." });
  }
});

// GET /api/ai/eligibility  — history
router.get("/eligibility", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    let history = [];

    if (conn.isMock) {
      const db = getMockDb();
      history = db.eligibilityChecks
        .filter((c) => c.userId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      history = await EligibilityCheck.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }

    res.json({ success: true, history });
  } catch (err) {
    console.error("GET Eligibility History Error:", err);
    res.status(500).json({ error: "Failed to fetch eligibility history." });
  }
});

export default router;
