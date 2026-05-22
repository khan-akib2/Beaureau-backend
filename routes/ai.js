import express from "express";
import mongoose from "mongoose";
import dbConnect, { getMockDb, saveMockDb } from "../lib/db.js";
import ChatHistory from "../models/ChatHistory.js";
import EligibilityCheck from "../models/EligibilityCheck.js";
import { requireAuth } from "../lib/auth.js";
import { chatWithGemini, translateLegalText, checkEligibility, generateSchemeGuide, generateChatTitle } from "../lib/gemini.js";

const router = express.Router();

// ── Multi-Session Chat ─────────────────────────────────────────────────────────

// POST /api/ai/chat/new  — create a new chat session
router.post("/chat/new", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const title = req.body.title || "New Conversation";
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    
    let session = null;
    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      session = {
        _id: "chat_" + Math.random().toString(36).substr(2, 9),
        userId: req.user.id,
        title,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.chatHistories.push(session);
      saveMockDb(db);
    } else {
      session = await ChatHistory.create({
        userId: req.user.id,
        title,
        messages: []
      });
    }
    res.json({ success: true, session });
  } catch (err) {
    console.error("Create Chat Session Error:", err);
    res.status(500).json({ error: "Failed to create new conversation." });
  }
});

// GET /api/ai/chat  — fetch list of all sessions for current user (meta-only)
router.get("/chat", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let list = [];

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      list = db.chatHistories
        .filter((c) => c.userId === req.user.id)
        .map(c => ({ _id: c._id, title: c.title, updatedAt: c.updatedAt || c.createdAt }));
    } else {
      list = await ChatHistory.find({ userId: req.user.id })
        .select("title updatedAt")
        .sort({ updatedAt: -1 });
    }

    res.json({ success: true, sessions: list });
  } catch (err) {
    console.error("GET Chat Sessions List Error:", err);
    res.status(500).json({ error: "Failed to fetch conversations list." });
  }
});

// GET /api/ai/chat/:id  — fetch full messages for a specific session
router.get("/chat/:id", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let session = null;

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      session = db.chatHistories.find((c) => c._id === req.params.id && c.userId === req.user.id);
    } else {
      session = await ChatHistory.findOne({ _id: req.params.id, userId: req.user.id });
    }

    if (!session) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    res.json({ success: true, messages: session.messages || [], title: session.title });
  } catch (err) {
    console.error("GET Chat Session Detail Error:", err);
    res.status(500).json({ error: "Failed to fetch conversation details." });
  }
});

// POST /api/ai/chat/:id  — send user message to specific session, get response, update DB and title
router.post("/chat/:id", requireAuth, async (req, res) => {
  try {
    const { message, fileUrl, fileName, fileType, language } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);
    let session = null;

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      session = db.chatHistories.find((c) => c._id === req.params.id && c.userId === req.user.id);
    } else {
      session = await ChatHistory.findOne({ _id: req.params.id, userId: req.user.id });
    }

    if (!session) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // Build context for AI
    const historyMessages = session.messages || [];
    const aiContext = [
      ...historyMessages.map(m => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        fileType: m.fileType
      })),
      { role: "user", content: message, fileUrl, fileName, fileType }
    ];

    // Limit to last 20 messages for context
    const slicedContext = aiContext.slice(-20);

    const responseText = await chatWithGemini(slicedContext, language);
    if (!responseText) {
      return res.status(502).json({ error: "AI failed to respond. Please try again." });
    }

    // Determine updated title if it was default
    let newTitle = session.title;
    if (session.title === "New Conversation" && message) {
      newTitle = await generateChatTitle(message);
    }

    // Save
    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      const dbSession = db.chatHistories.find((c) => c._id === req.params.id);
      if (dbSession) {
        dbSession.messages.push(
          {
            role: "user",
            content: message,
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            fileType: fileType || undefined,
            timestamp: new Date().toISOString()
          },
          { role: "model", content: responseText, timestamp: new Date().toISOString() }
        );
        dbSession.title = newTitle;
        dbSession.updatedAt = new Date().toISOString();
        saveMockDb(db);
      }
    } else {
      session.messages.push(
        {
          role: "user",
          content: message,
          fileUrl: fileUrl || undefined,
          fileName: fileName || undefined,
          fileType: fileType || undefined
        },
        { role: "model", content: responseText }
      );
      session.title = newTitle;
      await session.save();
    }

    res.json({ success: true, response: responseText, title: newTitle });
  } catch (err) {
    console.error("AI Chat Session Error:", err);
    res.status(500).json({ error: "AI failed to respond. Please try again." });
  }
});

// DELETE /api/ai/chat/:id  — delete session
router.delete("/chat/:id", requireAuth, async (req, res) => {
  try {
    const conn = await dbConnect();
    const isRealObjectId = mongoose.Types.ObjectId.isValid(req.user.id);

    if (conn.isMock || !isRealObjectId) {
      const db = getMockDb();
      db.chatHistories = db.chatHistories.filter(c => !(c._id === req.params.id && c.userId === req.user.id));
      saveMockDb(db);
    } else {
      await ChatHistory.deleteOne({ _id: req.params.id, userId: req.user.id });
    }

    res.json({ success: true, message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("DELETE Chat Session Error:", err);
    res.status(500).json({ error: "Failed to delete conversation." });
  }
});

// POST /api/ai/chat  — send user message to Gemini (one-off without session storage)
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { message, fileUrl, fileName, fileType, language } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    const responseText = await chatWithGemini([{ role: "user", content: message, fileUrl, fileName, fileType }], language);
    res.json({ success: true, response: responseText });
  } catch (err) {
    console.error("One-off AI Chat Error:", err);
    res.status(500).json({ error: "AI failed to respond. Please try again." });
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

// ── Scheme Application Guide ──────────────────────────────────────────────────

// POST /api/ai/guide  — generate application roadmap and interactive info
router.post("/guide", requireAuth, async (req, res) => {
  try {
    const { schemeName, department, description, userProfile } = req.body;
    if (!schemeName || !department) {
      return res.status(400).json({ error: "schemeName and department are required." });
    }
    const guide = await generateSchemeGuide(schemeName, department, description || "", userProfile || {});
    res.json({ success: true, guide });
  } catch (err) {
    console.error("Scheme Guide Error:", err);
    res.status(500).json({ error: "Failed to generate scheme guide." });
  }
});

// POST /api/ai/guide/chat  — chat specifically about a scheme application pathway
router.post("/guide/chat", requireAuth, async (req, res) => {
  try {
    const { schemeName, department, messages } = req.body;
    if (!schemeName || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "schemeName and messages array are required." });
    }

    const systemPrompt = `You are BureauAI, the official portal guidance assistant. The citizen is asking for support specifically regarding applying to the scheme: "${schemeName}" issued by "${department || 'Government of India'}".
Your role is to guide the user on:
1. Online portal links or application pathways.
2. Required documents and eligibility nuances.
3. Troubleshooting any questions about application registration or processing status.
Be concise, clear, and direct. Keep your answers professional and friendly, referencing the scheme "${schemeName}" as the target. Always reply in the language the user asks. Remove any generic branding or mention of LLMs.`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map(m => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content
      }))
    ];

    const responseText = await chatWithGemini(chatMessages);
    res.json({ success: true, response: responseText });
  } catch (err) {
    console.error("Scheme Guide Chat Error:", err);
    res.status(500).json({ error: "Failed to process chat message." });
  }
});

export default router;
