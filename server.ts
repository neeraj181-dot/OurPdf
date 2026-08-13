import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy init AI client
function getAIClient() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "spoti-pdf-studio",
      },
    },
  });
}

// AI API Routes
app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { pdfText, fileName, pagesCount } = req.body;
    if (!pdfText) {
      return res.status(400).json({ error: "No text provided for summarization" });
    }

    const ai = getAIClient();
    const model = process.env.AI_MODEL_NAME || "gemini-3.6-flash";
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

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("AI Summarize error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI summary" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, pdfContext, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getAIClient();
    const model = process.env.AI_MODEL_NAME || "gemini-3.6-flash";
    
    // Construct system prompt with PDF context
    const systemInstruction = `You are SpotiPDF AI Assistant, an expert PDF document companion built into a Spotify-styled PDF Studio.
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

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat" });
  }
});

app.post("/api/ai/ocr-enhance", async (req, res) => {
  try {
    const { rawText, imageBase64 } = req.body;
    const ai = getAIClient();
    const model = process.env.AI_MODEL_NAME || "gemini-3.6-flash";

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
      contents = `Clean up and format this raw OCR text. Fix line breaks, spelling typos, restore headings, tables, and bullet points into immaculate Markdown format:\n\n${rawText}`;
    }

    const response = await ai.models.generateContent({
      model,
      contents,
    });

    res.json({ formattedText: response.text });
  } catch (error: any) {
    console.error("AI OCR error:", error);
    res.status(500).json({ error: error.message || "Failed to process OCR text" });
  }
});

app.post("/api/ai/translate", async (req, res) => {
  try {
    const { pdfText, targetLanguage } = req.body;
    if (!pdfText || !targetLanguage) {
      return res.status(400).json({ error: "Missing text or target language" });
    }

    const ai = getAIClient();
    const model = process.env.AI_MODEL_NAME || "gemini-3.6-flash";
    const prompt = `Translate the following PDF text into ${targetLanguage}. Maintain paragraph structure, technical terms, and clear formatting:\n\n${pdfText.slice(0, 20000)}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    res.json({ translatedText: response.text });
  } catch (error: any) {
    console.error("AI Translate error:", error);
    res.status(500).json({ error: error.message || "Failed to translate content" });
  }
});

app.post("/api/ai/smart-extract", async (req, res) => {
  try {
    const { pdfText } = req.body;
    const ai = getAIClient();
    const model = process.env.AI_MODEL_NAME || "gemini-3.6-flash";

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
    res.json({ fields: result });
  } catch (error: any) {
    console.error("AI Smart Extract error:", error);
    res.status(500).json({ error: error.message || "Failed to extract key fields" });
  }
});

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PDF Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
