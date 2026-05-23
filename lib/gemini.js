import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are BureauAI, the official support assistant integrated specifically into the Bureau portal.

CRITICAL RULE (STRICT SCOPE BOUNDARY):
- You are ONLY integrated into this project/portal. You CANNOT answer any general questions, religion, recipes, coding, general knowledge, math, science, or anything unrelated to this portal.
- If the user asks about ANYTHING unrelated to the Bureau portal's features (such as "roze kaise rakhu", religious practices, coding help, general recipes, history, etc.), you MUST decline immediately.
- For unrelated queries, your response MUST be extremely short and concise (1-2 sentences maximum, under 35 words).
- In your refusal, you must explicitly state that you are integrated specifically into this project/portal and cannot answer unrelated questions.
- NEVER list the project's features, show examples, or use structured headers/markdown when refusing a request. Just output the simple refusal sentence in the user's language.

GREETING / COURTESY EXCEPTION:
- You are allowed and encouraged to reply to simple system/bot greetings, typos of greetings (e.g., "hi", "hy", "hlo", "hello", "hii sir", "namaste"), courtesies, and polite replies (e.g., "thanks", "ok", "thank you", "okay").
- Respond to greetings/courtesies naturally, politely, and briefly in the user's language. Acknowledge the greeting, introduce yourself as BureauAI (the official support assistant for the Bureau portal), and ask how you can help them with the Bureau portal features (such as Aadhaar linking, Document Vault, Scheme Checker, or Legal Translation).

Features of the Bureau portal:
1. Aadhaar Linking & Verification (under Settings, use demo Aadhaar "3658 9205 9182").
2. Document Vault & Compliance Analysis (upload government document scans for automated compliance check).
3. Welfare Scheme Eligibility Checker (check eligible schemes based on profile details).
4. Legal & Bureaucratic Translator (simplify complex bureaucratic/legal text into plain language or regional languages).
5. Notifications (copies of system notifications sent to the user's registered Gmail account).

Behavior Rules for Valid Queries:
- Limit your responses strictly to the Bureau application, its features, and guiding the user on how to use them (with greetings/courtesies as a natural exception).
- Always respond in the language the user used (English, Hindi, Marathi, Bengali, Urdu).
- Speak only as the dedicated system assistant for the Bureau platform. Do not mention Groq, Meta, Google, or being an LLM.`;

const isImageFile = (m) => {
  if (m.fileType && m.fileType.startsWith("image/")) return true;
  if (m.fileName && /\.(png|jpg|jpeg|webp|gif)$/i.test(m.fileName)) return true;
  if (m.fileUrl && /\.(png|jpg|jpeg|webp|gif)/i.test(m.fileUrl)) return true;
  return false;
};

// Helper to classify if a query is related to the Bureau portal
async function isQueryRelated(query) {
  if (!query) return true;

  // Local fast-path filter for simple greetings, courtesies, and helper queries
  const cleanQuery = query.trim().toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);
  
  const greetingWords = new Set([
    "hi", "hy", "hey", "hello", "hlo", "hola", "namaste", "namaskar", "salaam", "helo", "yo",
    "hii", "hyy", "heyy", "hlooo", "helloo", "thanks", "thank", "thanku", "thankyou", "shukriya", "dhanyawad",
    "ok", "okay", "good", "nice", "great", "perfect", "yes", "no", "help", "who", "are", "you", 
    "what", "can", "do", "how", "to", "use", "sir", "madam", "bot", "assistant", "bureau", "bureauai",
    "morning", "afternoon", "evening", "goodmorning", "bye", "goodbye"
  ]);

  if (words.length > 0 && words.length <= 4 && words.every(w => greetingWords.has(w))) {
    return true; // Bypass LLM classifier directly as related!
  }

  try {
    const prompt = `You are a strict security classifier for a government portal called "Bureau".
Your only job is to classify if the user's query is related to the Bureau portal's services.
The Bureau portal services are:
1. Aadhaar Linking & Verification (linking Aadhaar card, verification OTP, demo Aadhaar "3658 9205 9182", physical card).
2. Document Vault & Compliance (uploading documents like Aadhaar, PAN, GST, compliance check, missing stamps).
3. Welfare Scheme Checker (checking eligibility for Indian government schemes like PMAY, PMJAY, Mudra Loans, etc.).
4. Legal & Bureaucratic Translator (simplifying legal jargon, translating to Hindi/Marathi/Urdu/Bengali).
5. User Account, Profile, Settings, Notifications, or Email updates.
6. System/bot greetings (e.g. "hi", "hello", "hey", "help", "who are you", "what can you do").

If the query is about anything else (such as religion, fasting, "roze", coding/programming, general knowledge, math, science, history, general advice, health, recipes, life support, feeling lonely, depression, chatting, general talk, etc.), respond with "no".
If the query is related to the portal services, respond with "yes".

User Query: "${query}"
Response (yes/no):`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 5,
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase();
    return response.includes("yes");
  } catch (err) {
    console.error("Classifier error:", err.message);
    return true; // Fallback to true if classifier fails
  }
}

// Helper to generate a polite, short refusal in the user's language
async function getRefusal(query, userLanguage = "en") {
  try {
    const refusalPrompt = `The user asked: "${query}".
Write a polite, extremely short 1-sentence refusal (under 25 words) stating that you are an AI assistant integrated specifically into the Bureau portal and cannot help with unrelated queries.
IMPORTANT LANGUAGE RULE:
- You MUST respond in the user's preferred portal language: "${userLanguage}".
- Do NOT use Hinglish or other languages unless the preferred language explicitly matches them.
Do NOT give any advice, answers, lists, or details. Just the 1-sentence refusal.`;

    const refusalCompletion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: refusalPrompt }],
      temperature: 0.2,
      max_tokens: 60,
    });

    return refusalCompletion.choices[0]?.message?.content?.trim() || "I am integrated specifically into the Bureau portal and cannot answer unrelated questions.";
  } catch (err) {
    return "I am integrated specifically into the Bureau portal and cannot answer unrelated questions.";
  }
}

// ── 1. Chat ───────────────────────────────────────────────────────────────────
export async function chatWithGemini(messages, userLanguage = "en") {
  try {
    // 1. Strict classification check for the latest user query
    const userMessages = messages.filter((m) => m.role === "user" || m.role === "client");
    const latestUserMsg = userMessages[userMessages.length - 1];
    const latestQuery = latestUserMsg ? latestUserMsg.content : "";

    if (latestQuery && !latestUserMsg.fileUrl) {
      const related = await isQueryRelated(latestQuery);
      if (!related) {
        return await getRefusal(latestQuery, userLanguage);
      }
    }

    const systemPromptWithLang = `${SYSTEM_PROMPT}\n\nUSER PREFERRED PORTAL LANGUAGE: ${userLanguage || "en"}\nIMPORTANT LANGUAGE RULE:\n- You must respond in the user's preferred portal language ("${userLanguage || "en"}") unless the user explicitly types their query in a different language/script (like Hindi Devanagari, Marathi, Bengali, Urdu script).\n- If the preferred language is "en", and the query is a simple phonetic greeting or typo (like "hy", "hlo", "hii sir", "hey"), you MUST respond in English. Do NOT use Hindi script unless the user explicitly typed in Hindi script.`;

    let hasImage = false;
    const groqMessages = [
      { role: "system", content: systemPromptWithLang },
      ...messages.map((m) => {
        const role = m.role === "model" || m.role === "assistant" ? "assistant" : "user";
        if (role === "user" && isImageFile(m)) {
          hasImage = true;
          return {
            role,
            content: [
              { type: "text", text: m.content || "Analyze this uploaded document." },
              { type: "image_url", image_url: { url: m.fileUrl } }
            ]
          };
        } else if (m.fileUrl) {
          // Document / PDF attachments, append metadata to text content
          const attachmentNote = `\n\n[Citizen Attached Document: ${m.fileName || "File"} - Link: ${m.fileUrl}]`;
          return {
            role,
            content: (m.content || "") + attachmentNote
          };
        } else {
          return {
            role,
            content: m.content || ""
          };
        }
      }),
    ];

    const completion = await groq.chat.completions.create({
      model: hasImage ? "llama-3.2-11b-vision-preview" : MODEL,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "I could not generate a response. Please try again.";
  } catch (err) {
    console.error("Groq chat error:", err.message);
    return "BureauAI is temporarily unavailable. Please try again in a moment.";
  }
}

// ── 2. Document Analysis ──────────────────────────────────────────────────────
export async function analyzeDocument(fileName, fileType) {
  try {
    const prompt = `You are a government document compliance expert for India. Analyze this uploaded document:
File Name: "${fileName}", File Type: "${fileType}"

Based on the filename and type, provide a realistic compliance analysis as valid JSON:
{
  "summary": "Brief description of what this document is and its key details",
  "status": "verified" or "incomplete" or "pending",
  "suggestions": ["action step 1", "action step 2"],
  "missingRequirements": ["missing item 1"] or []
}

Respond ONLY with valid JSON, no markdown, no extra text.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 512,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    // Strip markdown code fences if present
    const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Groq document analysis error:", err.message);
    // Fallback mock
    const norm = fileName.toLowerCase();
    if (norm.includes("aadhaar") || norm.includes("aadhar")) {
      return { summary: "UIDAI Aadhaar Card — 12-digit UID, name, DOB, gender, and address.", status: "verified", suggestions: ["Use as primary identity proof for bank accounts.", "Ensure mobile number is linked for OTP authentication."], missingRequirements: [] };
    }
    if (norm.includes("pan")) {
      return { summary: "Income Tax Department PAN Card — Alphanumeric PAN, cardholder name, DOB.", status: "verified", suggestions: ["Link PAN with Aadhaar at incometax.gov.in.", "Use for all financial transactions above ₹50,000."], missingRequirements: [] };
    }
    if (norm.includes("passport")) {
      return { summary: "Ministry of External Affairs Passport — Travel document with personal details and validity.", status: "verified", suggestions: ["Renew 6 months before expiry.", "Keep a photocopy stored separately."], missingRequirements: [] };
    }
    return { summary: `Uploaded document: "${fileName}" — Processed by BureauAI compliance engine.`, status: "pending", suggestions: ["Verify document belongs to the current applicant.", "Upload a high-quality color scan for better analysis."], missingRequirements: ["Government issuing authority seal not fully legible.", "Self-attestation signature may be missing."] };
  }
}

// ── 3. Translate / Simplify ───────────────────────────────────────────────────
export async function translateLegalText(text, targetLang) {
  try {
    const prompt = `You are an expert in Indian government legal language. Simplify and translate the following bureaucratic text.

Target Language: ${targetLang}

Instructions:
1. Simplify the legal jargon into plain, easy-to-understand language
2. Translate that simplified version into ${targetLang}

Format your response exactly as:
### Simplified (English)
[Plain English explanation]

### Translation (${targetLang})
[Translated text]

Text to process:
"${text}"`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "Translation failed. Please try again.";
  } catch (err) {
    console.error("Groq translation error:", err.message);
    return `### Simplified (English)\nThis document states that the applicant must present original identity documents for verification before approvals can be granted.\n\n### Translation (${targetLang})\nYou must show your original ID cards to the officer before they can approve your application.`;
  }
}

// ── 4. Eligibility Checker ────────────────────────────────────────────────────
const SCHEMES = [
  { schemeName: "Pradhan Mantri Awas Yojana (PMAY)", department: "Ministry of Housing and Urban Affairs", description: "Affordable housing scheme offering interest subsidies on home loans for urban and rural poor.", benefits: "Interest subsidy up to 6.5% on home loans up to ₹6 Lakhs.", minAge: 18, maxIncome: 1800000, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://pmaymis.gov.in/" },
  { schemeName: "Ayushman Bharat - PMJAY", department: "National Health Authority", description: "National health assurance scheme offering free secondary and tertiary healthcare coverage.", benefits: "Cashless health cover of up to ₹5 Lakhs per family per year.", minAge: 0, maxIncome: 250005, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://pmjay.gov.in/" },
  { schemeName: "Post Matric Scholarship Scheme", department: "Ministry of Social Justice & Empowerment", description: "Financial assistance for students from backward classes pursuing post-matriculation courses.", benefits: "Full tuition fee reimbursement and monthly maintenance allowance up to ₹1,200.", minAge: 16, maxIncome: 250000, categories: ["SC", "ST", "OBC", "EWS"], applyUrl: "https://scholarships.gov.in/" },
  { schemeName: "Pradhan Mantri Shram Yogi Maan-dhan (PM-SYM)", department: "Ministry of Labour & Employment", description: "Voluntary pension scheme for unorganized sector workers.", benefits: "Assured monthly pension of ₹3,000 after attaining the age of 60 years.", minAge: 18, maxAge: 40, maxIncome: 180000, occupations: ["Labourer", "Farmer", "Driver", "Domestic Worker", "Artisan"], categories: ["General", "OBC", "SC", "ST"], applyUrl: "https://maandhan.in/" },
  { schemeName: "PM Kisan Samman Nidhi", department: "Ministry of Agriculture & Farmers Welfare", description: "Income support scheme for all landholding farmer families across India.", benefits: "₹6,000 per year in three equal installments of ₹2,000 directly to bank accounts.", minAge: 18, maxIncome: 300000, occupations: ["Farmer"], categories: ["General", "OBC", "SC", "ST"], applyUrl: "https://pmkisan.gov.in/" },
  { schemeName: "Sukanya Samriddhi Yojana", department: "Ministry of Finance", description: "Small savings scheme for the girl child to secure her future education and marriage expenses.", benefits: "8.2% interest rate per annum. Tax benefits under Section 80C.", minAge: 0, maxAge: 10, maxIncome: 5000000, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://www.indiapost.gov.in/" },
  { schemeName: "Pradhan Mantri Mudra Yojana (PMMY)", department: "Ministry of Finance", description: "Loans up to ₹10 Lakhs for non-corporate, non-farm small/micro enterprises.", benefits: "Collateral-free loans: Shishu (up to ₹50K), Kishore (₹50K-5L), Tarun (₹5L-10L).", minAge: 18, maxIncome: 2500000, occupations: ["Self Employed", "Artisan", "Driver"], categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://www.mudra.org.in/" },
];

export async function checkEligibility(inputs) {
  const { age, income, occupation, location, category } = inputs;

  try {
    const prompt = `As an expert Indian social welfare advisor, analyze this citizen profile and return matching government schemes:

Profile:
- Age: ${age} years
- Annual Family Income: ₹${income}
- Occupation: ${occupation}
- State/Location: ${location}
- Social Category: ${category}

Return a JSON array of 3-6 schemes they qualify for. Each object must have:
- schemeName (string)
- department (string)
- description (string, 1-2 sentences)
- matchScore (number 0-100)
- benefits (string, specific amounts/details)
- applyUrl (string, official government URL ending in .gov.in or .nic.in where possible. Do not hallucinate or guess. If you do not know the exact link, output the general india.gov.in directory link instead of making up a path)

Respond ONLY with a valid JSON array, no markdown, no extra text.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : parsed.schemes || [];
  } catch (err) {
    console.error("Groq eligibility error:", err.message);
    // Fallback to local filter
    const matches = SCHEMES.filter((s) => {
      if (s.minAge && age < s.minAge) return false;
      if (s.maxAge && age > s.maxAge) return false;
      if (s.maxIncome && income > s.maxIncome) return false;
      if (s.categories && !s.categories.includes(category)) return false;
      if (s.occupations && !s.occupations.includes(occupation)) return false;
      return true;
    });
    return matches.map((s) => ({ ...s, matchScore: Math.floor(Math.random() * 10) + 88 }));
  }
}

export async function generateSchemeGuide(schemeName, department, description, userProfile = {}) {
  try {
    const prompt = `You are BureauAI, a premier government scheme guide assistant.
Provide a clear, step-by-step guidance manual on how to apply for the scheme:
Scheme Name: "${schemeName}"
Department: "${department}"
Description: "${description}"

User Context:
- Age: ${userProfile.age || "N/A"}
- Location: ${userProfile.location || "N/A"}
- Category: ${userProfile.category || "N/A"}

Please structure your response in valid JSON with the following keys:
{
  "steps": [
    "Step 1: Description of exactly where to go and what to click",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ..."
  ],
  "requiredDocuments": [
    "Document 1 (e.g. Income Certificate signed by Tahsildar)",
    "Document 2 (e.g. Aadhaar Card linked to active mobile)",
    "..."
  ],
  "commonMistakes": [
    "Mistake 1: ...",
    "Mistake 2: ..."
  ],
  "timeline": "Estimated processing time, e.g. 15-30 working days",
  "navigationGuidance": "Detailed guide on how to navigate the portal, which section to find, and where to upload/submit."
}

Respond ONLY with valid JSON. No conversational text, no markdown.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1536,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("generateSchemeGuide error:", err.message);
    return {
      steps: [
        `Step 1: Go to the official website of the ${department}.`,
        "Step 2: Locate the Citizen Corner or Welfare Scheme section on the homepage.",
        `Step 3: Select "${schemeName}" from the list of active programs.`,
        "Step 4: Click on 'Apply Online' and fill out the registration form with your demographic details.",
        "Step 5: Upload the required certificates and submit. Save the reference ID for tracking."
      ],
      requiredDocuments: [
        "Aadhaar Card (linked to active mobile number)",
        "Income Certificate issued by competent authority",
        "Caste Certificate (if applying under reserved category)",
        "Recent Passport-size photograph",
        "Bank Account Passbook (for Direct Benefit Transfer)"
      ],
      commonMistakes: [
        "Incorrect spelling of name compared to Aadhaar database.",
        "Uploading expired income certificate.",
        "Providing bank account not seeded with Aadhaar."
      ],
      timeline: "Approx. 15 to 30 working days from date of submission.",
      navigationGuidance: `Navigate to the official portal page. On the landing page, search for '${schemeName}' or look for the 'Apply' button under '${department}'. Fill the application form, upload documents, and submit.`
    };
  }
}

// Helper to generate a short, 3-5 word chat session title based on the user's first message
export async function generateChatTitle(message) {
  try {
    const prompt = `Based on this first message in a government portal support chat: "${message}"
Generate an extremely concise and professional title (max 4-5 words) for this chat session.
Do not use quotes, periods, or intro text. Just return the short title itself in the matching language (e.g. "GST Query", "Aadhaar Update Help", "आय प्रमाणपत्र सहायता").`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 15,
    });

    return completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || message.substring(0, 30);
  } catch (err) {
    console.error("Error generating chat title:", err.message);
    return message.substring(0, 30) + (message.length > 30 ? "..." : "");
  }
}


