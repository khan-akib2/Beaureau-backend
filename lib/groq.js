import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq = null;
if (GROQ_API_KEY) {
  try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
  } catch (err) {
    console.error("Failed to initialize Groq:", err.message);
  }
}

/**
 * Analyze a government document using Groq LLM.
 * Returns { summary, status, suggestions, missingRequirements }
 */
export async function analyzeDocumentWithGroq(fileName, fileType, fileSize) {
  const sizeKb = fileSize ? Math.round(fileSize / 1024) : "unknown";

  if (groq) {
    try {
      const prompt = `You are BureauAI — an expert Indian government document compliance officer.
A citizen has uploaded a document. Based on the metadata below, provide a thorough compliance analysis.

Document Metadata:
- File Name: "${fileName}"
- File Type: "${fileType}"
- File Size: ${sizeKb} KB

Respond ONLY with a valid JSON object (no markdown, no explanation) with exactly these fields:
{
  "summary": "A 2–3 sentence description of what this document likely is and its typical use in Indian bureaucracy.",
  "status": "verified" | "incomplete" | "pending",
  "documentType": "A short label like 'Aadhaar Card', 'PAN Card', 'GST Certificate', 'Income Certificate', etc.",
  "issuingAuthority": "The government body that typically issues this document.",
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"],
  "missingRequirements": ["missing item 1", "missing item 2"]
}

Rules:
- If the filename clearly indicates a known document (e.g. GST, Aadhaar, PAN, Passport, Ration), set status = "verified"
- If metadata suggests something is off (very small size for a PDF, wrong extension), set status = "incomplete"
- Keep suggestions practical and India-specific
- missingRequirements should be empty array [] if status is "verified"`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });

      const text = response.choices[0]?.message?.content || "{}";
      const result = JSON.parse(text);

      return {
        summary: result.summary || `Document "${fileName}" processed by BureauAI.`,
        status: result.status || "pending",
        documentType: result.documentType || "Government Document",
        issuingAuthority: result.issuingAuthority || "Government of India",
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        missingRequirements: Array.isArray(result.missingRequirements) ? result.missingRequirements : [],
      };
    } catch (err) {
      console.error("Groq document analysis error:", err.message);
    }
  }

  // ── Fallback: rule-based analysis if Groq is unavailable ──────────────────
  const norm = fileName.toLowerCase();

  if (norm.includes("gst")) {
    return {
      summary: "GST Registration Certificate issued by GSTN (Goods and Services Tax Network). This document is required for all businesses with turnover above ₹20 Lakhs.",
      status: "verified",
      documentType: "GST Certificate",
      issuingAuthority: "Goods and Services Tax Network (GSTN)",
      suggestions: [
        "Ensure GSTIN is 15 digits and matches the PAN of the entity.",
        "Verify the registration date and effective date on the certificate.",
        "File GST returns (GSTR-1, GSTR-3B) on time to keep registration active.",
      ],
      missingRequirements: [],
    };
  }
  if (norm.includes("aadhaar") || norm.includes("aadhar")) {
    return {
      summary: "UIDAI Aadhaar Card — the primary identity document for Indian citizens containing a 12-digit unique identification number.",
      status: "verified",
      documentType: "Aadhaar Card",
      issuingAuthority: "Unique Identification Authority of India (UIDAI)",
      suggestions: [
        "Link Aadhaar with your PAN card at the Income Tax portal.",
        "Update mobile number linked to Aadhaar at nearest Aadhaar Seva Kendra.",
        "Use masked Aadhaar for non-financial submissions to protect your full UID.",
      ],
      missingRequirements: [],
    };
  }
  if (norm.includes("pan")) {
    return {
      summary: "Permanent Account Number (PAN) card issued by the Income Tax Department. Mandatory for all financial transactions above ₹50,000.",
      status: "verified",
      documentType: "PAN Card",
      issuingAuthority: "Income Tax Department, Government of India",
      suggestions: [
        "Link PAN with Aadhaar before the deadline to avoid deactivation.",
        "Use e-PAN from the Income Tax portal for digital submissions.",
        "Check your PAN status at protean-tinpan.com.",
      ],
      missingRequirements: [],
    };
  }
  if (norm.includes("passport")) {
    return {
      summary: "Indian Passport issued by the Ministry of External Affairs. Used as proof of citizenship and identity for international travel.",
      status: "verified",
      documentType: "Indian Passport",
      issuingAuthority: "Ministry of External Affairs, Government of India",
      suggestions: [
        "Renew your passport at least 6 months before expiry for international travel.",
        "Link DigiLocker to your passport for digital access.",
        "Keep ECR/Non-ECR stamp page photocopies for visa applications.",
      ],
      missingRequirements: [],
    };
  }
  if (norm.includes("income") || norm.includes("salary")) {
    return {
      summary: "Income Certificate issued by the competent authority (Tahsildar/Revenue Officer) certifying annual family income for availing government benefits.",
      status: "pending",
      documentType: "Income Certificate",
      issuingAuthority: "District Revenue Authority / Tahsildar",
      suggestions: [
        "Ensure the certificate mentions the current financial year.",
        "Attach self-attested salary slips or IT return as supporting documents.",
        "Income certificate validity is typically 1 year — renew before applying for schemes.",
      ],
      missingRequirements: ["Government stamp/seal not confirmed", "Issuing officer signature required"],
    };
  }

  return {
    summary: `Uploaded document "${fileName}" (${fileType}, ${sizeKb} KB) has been received by BureauAI for compliance review.`,
    status: "incomplete",
    documentType: "Government Document",
    issuingAuthority: "Unknown — Please verify",
    suggestions: [
      "Ensure the document is a clear, high-resolution scan.",
      "Verify that all government seals and signatures are legible.",
      "Upload a color scan for better compliance verification.",
    ],
    missingRequirements: [
      "Document type could not be automatically identified.",
      "Government issuing authority seal not visible.",
    ],
  };
}
