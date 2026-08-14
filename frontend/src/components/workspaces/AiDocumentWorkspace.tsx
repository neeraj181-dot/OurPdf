import React, { useState } from "react";
import {
  Sparkles,
  MessageSquareText,
  ScanText,
  Languages,
  TableProperties,
  Send,
  Copy,
  Check,
  Clock,
  Tag,
  ListCheck,
  FileText,
  Bot,
  User,
  Zap,
} from "lucide-react";
import { PDFFileItem, AISummaryResult, ExtractedField, ChatMessage } from "../../types";
import { soundEffects } from "../../lib/audio";

interface AiDocumentWorkspaceProps {
  activeFile: PDFFileItem;
  activeAiTab: "summary" | "chat" | "ocr" | "translate" | "extract";
  setActiveAiTab: (tab: "summary" | "chat" | "ocr" | "translate" | "extract") => void;
}

export const AiDocumentWorkspace: React.FC<AiDocumentWorkspaceProps> = ({
  activeFile,
  activeAiTab,
  setActiveAiTab,
}) => {
  // Summary state
  const [summaryData, setSummaryData] = useState<AISummaryResult | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hello! I am your Document Assistant. Ask me anything about "${activeFile.name}". I can answer questions, locate clauses, or summarize key figures.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  // OCR state
  const [formattedOcrText, setFormattedOcrText] = useState("");
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  // Translate state
  const [targetLang, setTargetLang] = useState("Spanish");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  // Extract state
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Copy feedback
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    soundEffects.playClick();
    navigator.clipboard.writeText(text);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  // Run AI Summary
  const handleGenerateSummary = async () => {
    soundEffects.playClick();
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfText: activeFile.extractedText || "Sample Document text",
          fileName: activeFile.name,
          pagesCount: activeFile.pagesCount,
        }),
      });
      const data = await res.json();
      setSummaryData(data);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Run AI Chat
  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim()) return;

    soundEffects.playClick();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!msgText) setInputMessage("");
    setIsChatting(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          pdfContext: activeFile.extractedText || "No text available",
          history: chatMessages,
        }),
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: data.text || "I was unable to retrieve a response.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatting(false);
    }
  };

  // Run AI OCR
  const handleRunOcr = async () => {
    soundEffects.playClick();
    setIsProcessingOcr(true);
    try {
      const res = await fetch("/api/ai/ocr-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: activeFile.extractedText || "",
        }),
      });
      const data = await res.json();
      setFormattedOcrText(data.formattedText);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Run AI Translate
  const handleTranslate = async () => {
    soundEffects.playClick();
    setIsTranslating(true);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfText: activeFile.extractedText || "",
          targetLanguage: targetLang,
        }),
      });
      const data = await res.json();
      setTranslatedText(data.translatedText);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  // Run AI Field Extraction
  const handleExtractFields = async () => {
    soundEffects.playClick();
    setIsExtracting(true);
    try {
      const res = await fetch("/api/ai/smart-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfText: activeFile.extractedText || "",
        }),
      });
      const data = await res.json();
      setExtractedFields(data.fields || []);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Document Hub Header */}
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1DB954] text-black flex items-center justify-center shrink-0 font-bold">
            <Sparkles className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#1DB954] tracking-wider uppercase">
              <span>Smart Document Analysis</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">Document Intelligence Hub</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Active File: <span className="text-zinc-200 font-medium">{activeFile.name}</span>
            </p>
          </div>
        </div>

        {/* Tab Selector Pills */}
        <div className="hidden md:flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
          {[
            { id: "summary", label: "Summarizer", icon: Sparkles },
            { id: "chat", label: "Q&A Search", icon: MessageSquareText },
            { id: "ocr", label: "OCR & Format", icon: ScanText },
            { id: "translate", label: "Translator", icon: Languages },
            { id: "extract", label: "Field Extraction", icon: TableProperties },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAiTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEffects.playClick();
                  setActiveAiTab(tab.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#1DB954] text-black font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Selector Mobile */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "summary", label: "Summarizer", icon: Sparkles },
          { id: "chat", label: "Chat Q&A", icon: MessageSquareText },
          { id: "ocr", label: "OCR & Format", icon: ScanText },
          { id: "translate", label: "Translator", icon: Languages },
          { id: "extract", label: "Field Extraction", icon: TableProperties },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAiTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundEffects.playClick();
                setActiveAiTab(tab.id as any);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? "bg-[#1DB954] text-black"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Active Tab Content */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 shadow-xl min-h-[450px] flex flex-col justify-between">
        {/* TAB 1: EXECUTIVE SUMMARIZER */}
        {activeAiTab === "summary" && (
          <div className="flex flex-col gap-6">
            {!summaryData ? (
              <div className="text-center py-16 flex flex-col items-center justify-center gap-4 my-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/40 text-[#1DB954] flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Generate AI Executive Brief</h3>
                  <p className="text-xs text-zinc-400 max-w-md mt-1">
                    Instantly extract core executive summaries, key takeaways, action items, and reading time for "{activeFile.name}".
                  </p>
                </div>
                <button
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing}
                  className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full shadow-[0_0_20px_rgba(29,185,84,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                  <Sparkles className={`w-4 h-4 ${isSummarizing ? "animate-spin" : ""}`} />
                  <span>{isSummarizing ? "ANALYZING DOCUMENT..." : "GENERATE AI BRIEF NOW"}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Executive Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div>
                    <span className="text-[10px] bg-emerald-900/60 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
                      {summaryData.documentCategory || "General Document"}
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      {summaryData.title || activeFile.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#1DB954]" />
                      <span>{summaryData.readingTimeMinutes || 3} min read</span>
                    </span>

                    <button
                      onClick={() =>
                        copyToClipboard(
                          `${summaryData.title}\n\nSUMMARY:\n${summaryData.summary}\n\nKEY POINTS:\n${summaryData.keyPoints?.join("\n")}`,
                          "summary"
                        )
                      }
                      className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                    >
                      {copiedTab === "summary" ? (
                        <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedTab === "summary" ? "Copied!" : "Copy Brief"}</span>
                    </button>
                  </div>
                </div>

                {/* Executive Summary Paragraph */}
                <div className="bg-[#202020] p-5 rounded-xl border border-zinc-800">
                  <h4 className="text-xs font-bold text-[#1DB954] uppercase tracking-wider mb-2">
                    Executive Summary
                  </h4>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    {summaryData.summary}
                  </p>
                </div>

                {/* Key Points & Action Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#202020] p-5 rounded-xl border border-zinc-800">
                    <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-teal-400" />
                      <span>Key Takeaways</span>
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {summaryData.keyPoints?.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[#1DB954] font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#202020] p-5 rounded-xl border border-zinc-800">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ListCheck className="w-4 h-4 text-emerald-400" />
                      <span>Action Items / Next Steps</span>
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {summaryData.actionItems?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Key Topics Tags */}
                {summaryData.keyTopics && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Tag className="w-4 h-4 text-[#1DB954]" />
                    <span className="font-bold">Topics:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {summaryData.keyTopics.map((topic, i) => (
                        <span key={i} className="bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full text-[11px]">
                          #{topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHAT WITH PDF */}
        {activeAiTab === "chat" && (
          <div className="flex flex-col h-[500px]">
            {/* Quick Prompt Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-zinc-800 custom-scrollbar">
              <span className="text-xs text-zinc-500 font-bold shrink-0">Prompts:</span>
              {[
                "Summarize key obligations in this document",
                "Are there any specific dates or deadlines mentioned?",
                "List all monetary amounts or financial figures",
                "Explain the main objective in 2 simple sentences",
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0"
                >
                  "{prompt}"
                </button>
              ))}
            </div>

            {/* Chat Message History */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 custom-scrollbar">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-[#1DB954] text-black flex items-center justify-center shrink-0 font-bold text-xs shadow-md">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-xl p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1DB954] text-black font-semibold rounded-tr-none shadow-md"
                        : "bg-[#242424] text-zinc-200 rounded-tl-none border border-zinc-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`text-[9px] mt-1.5 block ${
                        msg.role === "user" ? "text-emerald-950" : "text-zinc-500"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {isChatting && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 italic">
                  <Sparkles className="w-4 h-4 animate-spin text-[#1DB954]" />
                  <span>Thinking & searching document context...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="pt-3 border-t border-zinc-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Ask any question about ${activeFile.name}...`}
                className="flex-1 bg-[#242424] text-white text-xs font-medium px-4 py-3 rounded-full border border-zinc-700 focus:border-[#1DB954] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isChatting || !inputMessage.trim()}
                className="w-10 h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 shadow-md"
              >
                <Send className="w-4 h-4 fill-black ml-0.5" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: OCR & FORMAT */}
        {activeAiTab === "ocr" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">AI OCR & Document Formatter</h3>
                <p className="text-xs text-zinc-400">
                  Clean up raw scanned text, fix spelling typos, and restore structured headings & Markdown formatting.
                </p>
              </div>

              <button
                onClick={handleRunOcr}
                disabled={isProcessingOcr}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-2 rounded-full transition-all"
              >
                <ScanText className={`w-4 h-4 ${isProcessingOcr ? "animate-spin" : ""}`} />
                <span>FORMAT DOCUMENT TEXT</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#202020] p-4 rounded-xl border border-zinc-800 flex flex-col h-80">
                <span className="text-xs font-bold text-zinc-400 mb-2">Extracted Raw Text</span>
                <textarea
                  readOnly
                  value={activeFile.extractedText || "No raw text available."}
                  className="w-full flex-1 bg-zinc-900 text-zinc-400 p-3 rounded text-xs font-mono resize-none focus:outline-none custom-scrollbar"
                />
              </div>

              <div className="bg-[#202020] p-4 rounded-xl border border-zinc-800 flex flex-col h-80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#1DB954]">Formatted AI Markdown Output</span>
                  {formattedOcrText && (
                    <button
                      onClick={() => copyToClipboard(formattedOcrText, "ocr")}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedTab === "ocr" ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                  )}
                </div>
                <textarea
                  readOnly
                  value={formattedOcrText || "Click 'FORMAT DOCUMENT TEXT' to process..."}
                  className="w-full flex-1 bg-zinc-900 text-zinc-100 p-3 rounded text-xs font-mono resize-none focus:outline-none custom-scrollbar"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TRANSLATOR */}
        {activeAiTab === "translate" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#202020] p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <Languages className="w-6 h-6 text-[#1DB954]" />
                <div>
                  <h3 className="text-sm font-bold">Multi-Language AI Translator</h3>
                  <p className="text-xs text-zinc-400">Translate PDF contents instantly while maintaining structure.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-zinc-800 text-white text-xs font-bold px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none"
                >
                  {["Spanish", "French", "German", "Japanese", "Hindi", "Chinese", "Portuguese", "Italian", "Arabic", "Russian"].map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-2 rounded-full transition-all"
                >
                  <Sparkles className={`w-4 h-4 ${isTranslating ? "animate-spin" : ""}`} />
                  <span>TRANSLATE TO {targetLang.toUpperCase()}</span>
                </button>
              </div>
            </div>

            <div className="bg-[#202020] p-4 rounded-xl border border-zinc-800 flex flex-col h-80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#1DB954]">
                  Translated Output ({targetLang})
                </span>
                {translatedText && (
                  <button
                    onClick={() => copyToClipboard(translatedText, "trans")}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedTab === "trans" ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                )}
              </div>
              <textarea
                readOnly
                value={translatedText || "Select target language above and click Translate..."}
                className="w-full flex-1 bg-zinc-900 text-zinc-100 p-4 rounded text-xs leading-relaxed resize-none focus:outline-none custom-scrollbar"
              />
            </div>
          </div>
        )}

        {/* TAB 5: FIELD EXTRACTION */}
        {activeAiTab === "extract" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">AI Structured Field Extractor</h3>
                <p className="text-xs text-zinc-400">
                  Automatically parse dates, key financial figures, invoice numbers, signees, and legal terms into structured tables.
                </p>
              </div>

              <button
                onClick={handleExtractFields}
                disabled={isExtracting}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-2 rounded-full transition-all"
              >
                <TableProperties className={`w-4 h-4 ${isExtracting ? "animate-spin" : ""}`} />
                <span>EXTRACT KEY FIELDS</span>
              </button>
            </div>

            {extractedFields.length === 0 ? (
              <div className="text-center py-16 bg-[#202020] rounded-xl border border-zinc-800 text-zinc-400">
                <TableProperties className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-bold">No fields extracted yet</p>
                <p className="text-xs text-zinc-500 mt-1">Click 'EXTRACT KEY FIELDS' to detect structured metadata</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {extractedFields.map((field, i) => (
                  <div
                    key={i}
                    className="bg-[#202020] p-3.5 rounded-xl border border-zinc-800 flex flex-col justify-between hover:border-[#1DB954]/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                          {field.category}
                        </span>
                        <span className="text-[10px] bg-[#1DB954]/20 text-[#1DB954] font-mono px-1.5 py-0.2 rounded font-bold">
                          {field.confidence}% Match
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-300">{field.label}</h4>
                      <p className="text-sm font-bold text-white mt-1 break-all">{field.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
