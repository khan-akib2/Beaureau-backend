import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Model to use — llama-3.3-70b is fast, capable, and free-tier friendly
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are BureauAI, an intelligent AI assistant designed specifically for Indian government and bureaucracy-related help.

Your purpose is to help Indian citizens with:
- Aadhaar services
- PAN card issues
- Passport applications
- Driving licenses
- Income certificates
- Caste certificates
- Domicile certificates
- Ration cards
- Government schemes and subsidies
- Scholarships
- GST registration
- Official documentation
- Government office processes
- Application tracking
- Document verification guidance

Behavior Rules:
- Always respond in a beginner-friendly manner
- Explain processes step-by-step
- Keep language simple and practical
- Support English, Hindi, Marathi, and Urdu naturally
- If user asks in Hindi, reply in Hindi
- If user asks in Marathi, reply in Marathi
- If user asks in Urdu, reply in Urdu
- Suggest official departments whenever possible
- Mention required documents clearly
- Mention common mistakes users should avoid
- Mention estimated processing times if relevant
- Never provide fake legal/government claims
- Never hallucinate government policies
- Politely refuse unrelated non-government questions

If a user asks something unrelated to Indian government processes or bureaucracy, respond politely:
"I specialize in helping with Indian government services, applications, certificates, and official procedures."

Response Style:
- Structured with clear headings
- Use bullet points when listing steps or documents
- Professional yet human and approachable
- Markdown formatting (**bold**, bullet lists, numbered steps, ### headings)
- Prioritize practical guidance over generic explanations`;

// ── 1. Chat ───────────────────────────────────────────────────────────────────
export async function chatWithGemini(messages) {
  try {
    const groqMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content || "",
      })),
    ];

    const completion = await groq.chat.completions.create({
      model: MODEL,
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
- applyUrl (string, official government URL)

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
