import { GoogleGenAI } from "@google/genai";

function getAIClient() {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "easy-pdf",
      },
    },
  });
}

function getModelName() {
  return process.env.AI_MODEL_NAME || "gemini-3.6-flash";
}

export async function summarizeDocument(pdfText: string, fileName?: string, pagesCount?: number) {
  const ai = getAIClient();
  const model = getModelName();
  const prompt = `You are a world-class PDF Document Intelligence AI.
Analyze the following document context from file "${fileName || "Document.pdf"}" (${pagesCount || 1} pages):

DOCUMENT TEXT:
${pdfText.slice(0, 30000)}

Please output a comprehensive, beautifully structured JSON response with:
1. "title": Document inferred title
2. "summary": A concise executive summary (2-3 paragraphs)
3. "keyPoints": Array of 4-6 crucial bullet takeaways
4. "actionItems": Array of action items or follow-ups identified (if any)
5. "documentCategory": e.g. "Report", "Invoice", "Legal Contract", "Academic Paper", "User Manual", etc.
6. "readingTimeMinutes": Estimated reading time integer
7. "keyTopics": Array of 3-5 tags

Return strictly valid JSON matching this schema.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function chatWithDocument(message: string, pdfContext?: string, history?: Array<{ role: string; text: string }>) {
  const ai = getAIClient();
  const model = getModelName();

  const systemInstruction = `You are Easy PDF AI Assistant, an expert PDF document companion built into Easy PDF.
Answer questions accurately based on the provided PDF content. If the answer is directly in the document, quote or cite specific context or page hints when possible.
Be helpful, precise, clear, and engaging.

PDF DOCUMENT CONTENT:
${(pdfContext || "No document text available").slice(0, 35000)}`;

  const contents: any[] = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      });
    }
  }
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
    },
  });

  return { text: response.text };
}

export async function ocrEnhanceDocument(rawText?: string, imageBase64?: string) {
  const ai = getAIClient();
  const model = getModelName();

  let contents: any;
  if (imageBase64) {
    const mime = imageBase64.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    contents = {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mime,
          },
        },
        {
          text: "Extract all readable text, tables, and structured data from this document image with high precision. Reformat into clean Markdown.",
        },
      ],
    };
  } else {
    contents = `Clean up and format this raw OCR text. Fix line breaks, spelling typos, restore headings, tables, and bullet points into immaculate Markdown format:\n\n${rawText || ""}`;
  }

  const response = await ai.models.generateContent({
    model,
    contents,
  });

  return { formattedText: response.text };
}

export async function translateDocument(pdfText: string, targetLanguage: string) {
  const ai = getAIClient();
  const model = getModelName();
  const prompt = `Translate the following PDF text into ${targetLanguage}. Maintain paragraph structure, technical terms, and clear formatting:\n\n${pdfText.slice(0, 20000)}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return { translatedText: response.text };
}

export async function smartExtractFields(pdfText: string) {
  const ai = getAIClient();
  const model = getModelName();

  const prompt = `Analyze this PDF document and extract structured key fields into JSON format (e.g. key dates, monetary values, names, organization/parties, invoice/reference numbers, key legal clauses, or table items).
DOCUMENT CONTENT:
${pdfText.slice(0, 25000)}

Return JSON array of extracted fields with keys: "label", "value", "category" ("date", "financial", "contact", "legal", "other"), "confidence" (0-100).`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const result = JSON.parse(response.text || "[]");
  return { fields: result };
}
