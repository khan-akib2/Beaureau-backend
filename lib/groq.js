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
export async function analyzeDocumentWithGroq(fileName, fileType, fileSize, fileUrl) {
  const sizeKb = fileSize ? Math.round(fileSize / 1024) : "unknown";

  const isImg = fileType?.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName || "") || /\.(png|jpg|jpeg|webp|gif)/i.test(fileUrl || "");

  if (groq) {
    try {
      if (isImg && fileUrl) {
        // Step 1: Call Llama 3.2 Vision to verify if it is a valid government document, ID card, form, certificate, notice, utility bill, or process scan.
        const validationPrompt = `Analyze the uploaded image. Determine if it is a valid government document, ID card, form, certificate, notice, utility bill, or process scan.
If it is a selfie, meme, landscape, animal, or general unrelated image, it is NOT a valid document.

Respond ONLY with a valid JSON object with exactly these fields:
{
  "isValid": boolean,
  "reason": "If invalid, explain why in 1-2 sentences. If valid, state 'Valid document'."
}`;

        const valResponse = await groq.chat.completions.create({
          model: "llama-3.2-11b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: validationPrompt },
                { type: "image_url", image_url: { url: fileUrl } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 150,
          response_format: { type: "json_object" }
        });

        const valText = valResponse.choices[0]?.message?.content || "{}";
        const valResult = JSON.parse(valText);

        if (!valResult.isValid) {
          return {
            summary: valResult.reason || "Rejected: The uploaded image is not a valid bureaucratic document, ID, form, or notice.",
            status: "incomplete",
            documentType: "Invalid Document",
            issuingAuthority: "Unknown",
            suggestions: [
              "Please upload a valid government document, ID card, notice, or form.",
              "Ensure the photo contains only the document and is not a selfie, meme, or landscape."
            ],
            missingRequirements: [
              "Invalid document type uploaded.",
              valResult.reason || "Unrelated image content detected."
            ]
          };
        }

        // Step 2: Extract document info using the vision model
        const extractionPrompt = `You are BureauAI — an expert Indian government document compliance officer.
The citizen has uploaded this verified document image. Extract the document information and construct a compliance report.

Respond ONLY with a valid JSON object with exactly these fields:
{
  "summary": "A 2–3 sentence description of what this document is based on what you see in the image and its typical use in Indian bureaucracy.",
  "status": "verified" | "incomplete" | "pending",
  "documentType": "A short label like 'Aadhaar Card', 'PAN Card', 'GST Certificate', 'Income Certificate', etc.",
  "issuingAuthority": "The government body that issued this document.",
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"],
  "missingRequirements": ["missing item 1", "missing item 2"]
}

Rules:
- If the document is clear, complete, and authentic, set status = "verified" and missingRequirements = []
- If something is missing (e.g. signature, stamp, date, or blurry sections), set status = "incomplete" or "pending" and add the items to missingRequirements
- Keep suggestions practical and India-specific`;

        const extResponse = await groq.chat.completions.create({
          model: "llama-3.2-11b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: extractionPrompt },
                { type: "image_url", image_url: { url: fileUrl } }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 600,
          response_format: { type: "json_object" }
        });

        const extText = extResponse.choices[0]?.message?.content || "{}";
        const extResult = JSON.parse(extText);

        return {
          summary: extResult.summary || `Verified document "${fileName}" processed.`,
          status: extResult.status || "verified",
          documentType: extResult.documentType || "Government Document",
          issuingAuthority: extResult.issuingAuthority || "Government of India",
          suggestions: Array.isArray(extResult.suggestions) ? extResult.suggestions : [],
          missingRequirements: Array.isArray(extResult.missingRequirements) ? extResult.missingRequirements : []
        };
      }

      // Default text metadata check for non-images
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
        model: "llama-3.1-8b-instant",
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
