import { Router, Request, Response } from "express";
import {
  summarizeDocument,
  chatWithDocument,
  ocrEnhanceDocument,
  translateDocument,
  smartExtractFields,
} from "../services/ai.js";

export const aiRouter = Router();

aiRouter.post("/summarize", async (req: Request, res: Response) => {
  try {
    const { pdfText, fileName, pagesCount } = req.body;
    if (!pdfText) {
      return res.status(400).json({ error: "No text provided for summarization" });
    }
    const result = await summarizeDocument(pdfText, fileName, pagesCount);
    return res.json(result);
  } catch (error: any) {
    console.error("AI Summarize error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI summary" });
  }
});

aiRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, pdfContext, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await chatWithDocument(message, pdfContext, history);
    return res.json(result);
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return res.status(500).json({ error: error.message || "Failed to process chat" });
  }
});

aiRouter.post("/ocr-enhance", async (req: Request, res: Response) => {
  try {
    const { rawText, imageBase64 } = req.body;
    const result = await ocrEnhanceDocument(rawText, imageBase64);
    return res.json(result);
  } catch (error: any) {
    console.error("AI OCR error:", error);
    return res.status(500).json({ error: error.message || "Failed to process OCR text" });
  }
});

aiRouter.post("/translate", async (req: Request, res: Response) => {
  try {
    const { pdfText, targetLanguage } = req.body;
    if (!pdfText || !targetLanguage) {
      return res.status(400).json({ error: "Missing text or target language" });
    }
    const result = await translateDocument(pdfText, targetLanguage);
    return res.json(result);
  } catch (error: any) {
    console.error("AI Translate error:", error);
    return res.status(500).json({ error: error.message || "Failed to translate content" });
  }
});

aiRouter.post("/smart-extract", async (req: Request, res: Response) => {
  try {
    const { pdfText } = req.body;
    const result = await smartExtractFields(pdfText);
    return res.json(result);
  } catch (error: any) {
    console.error("AI Smart Extract error:", error);
    return res.status(500).json({ error: error.message || "Failed to extract key fields" });
  }
});
