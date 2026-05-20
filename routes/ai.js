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

    // Build conversation — prefer full messages array for session memory,
    // fall back to single message
    let conversation = messages?.length > 0
      ? messages
      : [{ role: "user", content: message }];

    // Keep last 20 messages max to avoid token bloat while preserving context
    if (conversation.length > 20) {
      conversation = conversation.slice(-20);
    }

    // Ensure the last message is from the user
    const lastMsg = conversation[conversation.length - 1];
    if (!lastMsg || (lastMsg.role !== "user" && lastMsg.role !== "human")) {
      return res.status(400).json({ error: "Last message must be from the user." });
    }

    const responseText = await chatWithGemini(conversation);

    if (!responseText) {
      return res.status(502).json({ error: "AI returned an empty response. Please try again." });
    }

    // Persist to DB asynchronously — don't block the response
    const newUserMsg = conversation[conversation.length - 1];
    dbConnect().then((conn) => {
      if (conn.isMock) {
        const db = getMockDb();
        let history = db.chatHistories.find((c) => c.userId === req.user.id);
        if (!history) {
          history = { _id: "chat_" + Math.random().toString(36).substr(2, 9), userId: req.user.id, messages: [], createdAt: new Date().toISOString() };
          db.chatHistories.push(history);
        }
        history.messages.push(
          { role: "user", content: newUserMsg.content, timestamp: new Date().toISOString() },
          { role: "model", content: responseText, timestamp: new Date().toISOString() }
        );
        history.updatedAt = new Date().toISOString();
        saveMockDb(db);
      } else {
        ChatHistory.findOneAndUpdate(
          { userId: req.user.id },
          { $push: { messages: [{ role: "user", content: newUserMsg.content }, { role: "model", content: responseText }] } },
          { upsert: true, new: true }
        ).catch((e) => console.error("Chat history save error:", e));
      }
    }).catch((e) => console.error("DB connect error during chat save:", e));

    res.json({ success: true, response: responseText });
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: "AI failed to respond. Please try again." });
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
