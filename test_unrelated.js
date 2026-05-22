import "dotenv/config";
import { chatWithGemini } from "./lib/gemini.js";

async function testQuery(query, lang = "en") {
  console.log(`\n-----------------------------\nQuery: "${query}" (Preferred Lang: ${lang})`);
  const response = await chatWithGemini([{ role: "user", content: query }], lang);
  console.log("AI Response:", response);
}

async function run() {
  const queries = [
    { q: "roze kaise rakhu", lang: "en" },
    { q: "Can you write a python script to reverse a string?", lang: "en" },
    { q: "I am feeling very lonely and sad today", lang: "en" },
    { q: "what is the capital of India?", lang: "en" },
    { q: "hi, who are you?", lang: "en" },
    { q: "hy", lang: "en" },
    { q: "ok thanks", lang: "en" },
    { q: "hii sir", lang: "en" },
    { q: "hlo", lang: "en" },
    { q: "आधार कार्ड कैसे लिंक करें", lang: "hi" },
    { q: "how to link aadhaar card", lang: "en" },
    { q: "what documents do I need for income certificate?", lang: "en" }
  ];

  for (const item of queries) {
    await testQuery(item.q, item.lang);
  }
}

run();
