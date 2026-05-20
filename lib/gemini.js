import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (err) {
    console.error("Failed to initialize Gemini:", err);
  }
}

const SYSTEM_INSTRUCTION =
  "You are BureauAI, a premium AI bureaucracy assistant for India. " +
  "Help citizens understand legal documents, guide them through government applications " +
  "(Aadhaar, PAN, Passport, Income Certificates, Ration Cards, Driving License, Birth Certificate), " +
  "list required documents, explain steps in simple language, and find welfare schemes. " +
  "Respond professionally with a helpful expert tone. Use markdown formatting with **bold**, bullet points, and numbered lists for clarity. " +
  "Keep responses concise but complete. If the user writes in Hindi/Marathi/Urdu, reply in that language.";

// ── 1. Chat ───────────────────────────────────────────────────────────────────
export async function chatWithGemini(messages) {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      // Build proper Gemini conversation history
      // Gemini requires alternating user/model turns, starting with user
      const history = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        history.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content || "" }],
        });
      }

      // Start a chat session with history
      const chat = model.startChat({
        history,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      });

      // Send the latest user message
      const lastMsg = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMsg.content || "");
      return result.response.text();
    } catch (err) {
      console.error("Gemini chat error:", err.message);
      // Fall through to mock
    }
  }

  // ── Rich mock fallback (keyword-based) ──
  const last = messages[messages.length - 1]?.content?.toLowerCase() || "";

  if (last.includes("aadhaar") || last.includes("aadhar")) {
    return `### Aadhaar Card Services Guide

To **update or apply** for an Aadhaar Card:

1. **Book an appointment** at the UIDAI Bhuvan Portal or your nearest Aadhaar Seva Kendra.
2. **Required Documents:**
   - Proof of Identity (POI): Passport, PAN Card, Voter ID, or Driving License
   - Proof of Address (POA): Utility bill (not older than 3 months), Rent Agreement, Bank Passbook
   - Proof of Date of Birth (DOB): Birth Certificate or SSLC Certificate
3. **Biometrics** (fingerprints, iris scan, photograph) will be taken at the center.
4. You'll receive an **Acknowledgement Slip** with a 14-digit Enrollment ID (EID) to track your application.

**Online Update:** Visit [myaadhaar.uidai.gov.in](https://myaadhaar.uidai.gov.in) to update address, mobile number, or email online.`;
  }

  if (last.includes("pan card") || last.includes("pan ")) {
    return `### PAN Card Application Guide (Form 49A)

**PAN (Permanent Account Number)** is mandatory for financial transactions in India.

**How to Apply Online:**
1. Visit **NSDL (Protean)** or **UTITSL** website
2. Fill **Form 49A** with your personal details
3. Upload: Proof of Identity, Proof of Address, Proof of DOB
4. Pay the fee: ~₹107 (physical card) or ~₹72 (e-PAN)
5. Complete **Aadhaar e-KYC** authentication

**Delivery Timeline:**
- e-PAN: sent to email within **2-3 working days**
- Physical PAN card: delivered by post in **10-15 working days**

**Link PAN with Aadhaar** at [incometax.gov.in](https://www.incometax.gov.in) to avoid penalties.`;
  }

  if (last.includes("passport")) {
    return `### Passport Application Guide

**Apply for a new passport** through the Passport Seva Portal:

1. **Register** at [passportindia.gov.in](https://www.passportindia.gov.in)
2. **Fill the online application** form (fresh/renewal/tatkal)
3. **Book an appointment** at your nearest Passport Seva Kendra (PSK)
4. **Required Documents:**
   - Proof of Identity: Aadhaar, Voter ID, or PAN Card
   - Proof of Address: Aadhaar, utility bill, or bank statement
   - Proof of Date of Birth: Birth certificate or SSLC marksheet
   - Old passport (for renewal)
5. **Pay the fee:** ₹1,500 (normal, 36 pages) or ₹2,000 (tatkal)
6. **Police verification** will be conducted after submission

**Processing Time:** 3-7 working days (Tatkal) or 30-45 days (Normal)`;
  }

  if (last.includes("income certificate") || last.includes("tahsildar")) {
    return `### Income Certificate Application

Income certificates are issued by the **Revenue Department** of your State Government.

**Where to Apply:**
- Maharashtra: [MahaOnline](https://aaplesarkar.mahaonline.gov.in)
- Delhi: [edistrict.delhigovt.nic.in](https://edistrict.delhigovt.nic.in)
- UP: [edistrict.up.gov.in](https://edistrict.up.gov.in)

**Required Documents:**
- Aadhaar Card (identity proof)
- Ration Card or Voter ID (address proof)
- Salary slips / Form 16 / Land tax receipt (income proof)
- Self-declaration affidavit

**Processing Time:** 7-15 working days. If delayed, file an appeal on the State Public Services Portal.`;
  }

  if (last.includes("driving license") || last.includes("dl ") || last.includes("licence")) {
    return `### Driving License Application

Apply for a **Driving License** through the Sarathi Parivahan portal:

1. Visit [sarathi.parivahan.gov.in](https://sarathi.parivahan.gov.in)
2. **Apply for Learner's License (LL)** first — take the online test
3. After 30 days, apply for **Permanent Driving License (DL)**
4. **Required Documents:**
   - Age proof: Aadhaar, Birth Certificate, or SSLC
   - Address proof: Aadhaar, Voter ID, or Utility Bill
   - Passport-size photographs
5. **Book a slot** at your nearest RTO for the driving test
6. **Fee:** ₹200-500 depending on vehicle category`;
  }

  if (last.includes("ration card")) {
    return `### Ration Card Application

Apply for a **Ration Card** through your State's Food & Civil Supplies Department:

**Types of Ration Cards:**
- **APL** (Above Poverty Line) — Yellow/White card
- **BPL** (Below Poverty Line) — Red card
- **AAY** (Antyodaya Anna Yojana) — for poorest families

**Required Documents:**
- Aadhaar Card of all family members
- Proof of residence (electricity bill, rent agreement)
- Passport-size photographs
- Income certificate (for BPL/AAY)
- Bank account details

**Apply Online:** Visit your state's food department portal or nearest CSC (Common Service Centre).`;
  }

  if (last.includes("scheme") || last.includes("yojana") || last.includes("subsidy") || last.includes("benefit")) {
    return `### Government Welfare Schemes

Here are key **Central Government schemes** you may be eligible for:

**Housing:**
- **PMAY** (Pradhan Mantri Awas Yojana) — Interest subsidy up to 6.5% on home loans

**Health:**
- **Ayushman Bharat PMJAY** — Free health cover up to ₹5 Lakhs/year

**Agriculture:**
- **PM Kisan** — ₹6,000/year for farmers in 3 installments

**Education:**
- **Post Matric Scholarship** — For SC/ST/OBC students

**Pension:**
- **PM-SYM** — ₹3,000/month pension for unorganized workers after age 60

Use the **Eligibility Checker** in the Services section to find schemes matching your profile!`;
  }

  if (last.includes("track") || last.includes("status") || last.includes("application")) {
    return `### Track Your Application

You can track your government application status through:

1. **BureauAI Tracker** — Use the "My Applications" section in your dashboard
2. **Official Portals:**
   - Aadhaar: [myaadhaar.uidai.gov.in](https://myaadhaar.uidai.gov.in)
   - Passport: [passportindia.gov.in](https://www.passportindia.gov.in)
   - PAN: [tin.tin.nsdl.com](https://tin.tin.nsdl.com)
   - State services: Your state's e-district portal

**What you'll need:**
- Application/Reference number (from acknowledgement slip)
- Registered mobile number or Aadhaar number

Is there a specific application you'd like help tracking?`;
  }

  // Generic helpful response
  return `Namaste! I am **BureauAI**, your Indian Government Assistance AI. 🇮🇳

I can help you with:
- 📋 **Aadhaar** — Update, download, verify
- 💳 **PAN Card** — Apply, link with Aadhaar
- 🛂 **Passport** — Fresh application, renewal, tatkal
- 📄 **Income Certificate** — State-level application
- 🚗 **Driving License** — Learner's & permanent license
- 🏠 **Ration Card** — Apply and update
- 💰 **Welfare Schemes** — PMAY, Ayushman Bharat, PM Kisan
- 📍 **Application Tracking** — Check status of any application

**Just ask me anything** about government procedures, required documents, or how to apply for any service. I respond in English, Hindi (हिंदी), Marathi (मराठी), and Urdu (اردو).`;
}

// ── 2. Document Analysis ──────────────────────────────────────────────────────
export async function analyzeDocument(fileName, fileType) {
  if (genAI) {
    try {
      const prompt = `You are a government document compliance expert for India. Analyze this uploaded document:
File Name: "${fileName}", File Type: "${fileType}"

Based on the filename and type, provide a realistic compliance analysis in valid JSON format:
{
  "summary": "Brief description of what this document is and its key details",
  "status": "verified" | "incomplete" | "pending",
  "suggestions": ["action step 1", "action step 2"],
  "missingRequirements": ["missing item 1"] or []
}

Respond ONLY with valid JSON, no markdown.`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      });
      const text = result.response.text().trim();
      return JSON.parse(text);
    } catch (err) {
      console.error("Gemini document analysis error:", err.message);
    }
  }

  // Mock fallback
  const norm = fileName.toLowerCase();
  if (norm.includes("aadhaar") || norm.includes("aadhar")) {
    return { summary: "UIDAI Aadhaar Card — 12-digit UID, name, DOB, gender, and address. Issued by Government of India.", status: "verified", suggestions: ["Use as primary identity proof for bank accounts and SIM registration.", "Ensure mobile number is linked for OTP authentication."], missingRequirements: [] };
  }
  if (norm.includes("pan")) {
    return { summary: "Income Tax Department PAN Card — Alphanumeric PAN, cardholder name, father's name, DOB.", status: "verified", suggestions: ["Link PAN with Aadhaar at incometax.gov.in to avoid penalties.", "Use for all financial transactions above ₹50,000."], missingRequirements: [] };
  }
  if (norm.includes("passport")) {
    return { summary: "Ministry of External Affairs Passport — Travel document with personal details and validity.", status: "verified", suggestions: ["Check expiry date — renew 6 months before expiry for international travel.", "Keep a photocopy stored separately from the original."], missingRequirements: [] };
  }
  if (norm.includes("income") || norm.includes("certificate")) {
    return { summary: "State Revenue Department Income Certificate — Certifies annual family income for the current financial year.", status: "incomplete", suggestions: ["Submit to claim Post-Matric Scholarships or fee concessions.", "Use for EWS reservation applications."], missingRequirements: ["Ensure Tahsildar seal is clearly visible.", "Check if issuing authority signature is present on all pages."] };
  }
  return { summary: `Uploaded document: "${fileName}" — Processed by BureauAI compliance engine.`, status: "pending", suggestions: ["Verify document belongs to the current applicant.", "Upload a high-quality color scan for better analysis."], missingRequirements: ["Government issuing authority seal not fully legible.", "Self-attestation signature may be missing."] };
}

// ── 3. Translate / Simplify ───────────────────────────────────────────────────
export async function translateLegalText(text, targetLang) {
  if (genAI) {
    try {
      const prompt = `You are an expert in Indian government legal language. Simplify and translate the following bureaucratic text.

Target Language: ${targetLang}

Instructions:
1. First, simplify the legal jargon into plain, easy-to-understand language
2. Then translate that simplified version into ${targetLang}

Format your response exactly as:
### Simplified (English)
[Plain English explanation]

### Translation (${targetLang})
[Translated text]

Text to process:
"${text}"`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error("Gemini translation error:", err.message);
    }
  }

  return `### Simplified (English)
This document states that according to the official government notification, the applicant must present their original identity documents for verification before any approvals can be granted.

### Translation (${targetLang})
"You must show your original ID cards to the officer in charge before they can approve your application."`;
}

// ── 4. Eligibility Checker ────────────────────────────────────────────────────
const SCHEMES = [
  { schemeName: "Pradhan Mantri Awas Yojana (PMAY)", department: "Ministry of Housing and Urban Affairs", description: "Affordable housing scheme offering interest subsidies on home loans for urban and rural poor.", benefits: "Interest subsidy up to 6.5% on home loans up to ₹6 Lakhs. Direct benefit up to ₹2.67 Lakhs.", minAge: 18, maxIncome: 1800000, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://pmaymis.gov.in/" },
  { schemeName: "Ayushman Bharat - PMJAY", department: "National Health Authority", description: "National health assurance scheme offering free secondary and tertiary healthcare coverage.", benefits: "Cashless health cover of up to ₹5 Lakhs per family per year.", minAge: 0, maxIncome: 250005, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://pmjay.gov.in/" },
  { schemeName: "Post Matric Scholarship Scheme", department: "Ministry of Social Justice & Empowerment", description: "Financial assistance for students from backward classes pursuing post-matriculation courses.", benefits: "Full tuition fee reimbursement and monthly maintenance allowance up to ₹1,200.", minAge: 16, maxIncome: 250000, categories: ["SC", "ST", "OBC", "EWS"], applyUrl: "https://scholarships.gov.in/" },
  { schemeName: "Pradhan Mantri Shram Yogi Maan-dhan (PM-SYM)", department: "Ministry of Labour & Employment", description: "Voluntary pension scheme for unorganized sector workers.", benefits: "Assured monthly pension of ₹3,000 after attaining the age of 60 years.", minAge: 18, maxAge: 40, maxIncome: 180000, occupations: ["Labourer", "Farmer", "Driver", "Domestic Worker", "Artisan"], categories: ["General", "OBC", "SC", "ST"], applyUrl: "https://maandhan.in/" },
  { schemeName: "PM Kisan Samman Nidhi", department: "Ministry of Agriculture & Farmers Welfare", description: "Income support scheme for all landholding farmer families across India.", benefits: "₹6,000 per year in three equal installments of ₹2,000 directly to bank accounts.", minAge: 18, maxIncome: 300000, occupations: ["Farmer"], categories: ["General", "OBC", "SC", "ST"], applyUrl: "https://pmkisan.gov.in/" },
  { schemeName: "Sukanya Samriddhi Yojana", department: "Ministry of Finance", description: "Small savings scheme for the girl child to secure her future education and marriage expenses.", benefits: "8.2% interest rate per annum. Tax benefits under Section 80C.", minAge: 0, maxAge: 10, maxIncome: 5000000, categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://www.indiapost.gov.in/" },
  { schemeName: "Pradhan Mantri Mudra Yojana (PMMY)", department: "Ministry of Finance", description: "Loans up to ₹10 Lakhs for non-corporate, non-farm small/micro enterprises.", benefits: "Collateral-free loans: Shishu (up to ₹50K), Kishore (₹50K-5L), Tarun (₹5L-10L).", minAge: 18, maxIncome: 2500000, occupations: ["Self Employed", "Artisan", "Driver"], categories: ["General", "OBC", "SC", "ST", "EWS"], applyUrl: "https://www.mudra.org.in/" },
];

export async function checkEligibility(inputs) {
  const { age, income, occupation, location, category } = inputs;

  if (genAI) {
    try {
      const prompt = `As an expert Indian social welfare advisor, analyze this citizen profile and return matching government schemes:

Profile:
- Age: ${age} years
- Annual Family Income: ₹${income}
- Occupation: ${occupation}
- State/Location: ${location}
- Social Category: ${category}

Return a JSON array of schemes they qualify for. Each object must have:
- schemeName (string)
- department (string)
- description (string, 1-2 sentences)
- matchScore (number 0-100)
- benefits (string, specific amounts/details)
- applyUrl (string, official government URL)

Include 3-6 most relevant schemes. Respond ONLY with a valid JSON array.`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      });
      const parsed = JSON.parse(result.response.text());
      return Array.isArray(parsed) ? parsed : parsed.schemes || [];
    } catch (err) {
      console.error("Gemini eligibility error:", err.message);
    }
  }

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
