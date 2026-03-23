"use client";

import { useState, useEffect, useRef, useCallback } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/api";

interface ChatPanelProps {
  token: string;
  currentPage: string;
  onClose: () => void;
  onNavigate?: (page: string) => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
}

interface Message {
  id?: string;
  role: string;
  content: string;
  created_at?: string;
}

interface RegulationCardData {
  type: "regulation_card";
  title: string;
  citation: string;
  requirements_met: number;
  requirements_total: number;
  covered: string[];
  missing: string[];
}

interface ComplianceCheckData {
  type: "compliance_check";
  title: string;
  citation: string;
  requirements_met: number;
  requirements_total: number;
  covered: string[];
  missing: string[];
}

type StructuredData = RegulationCardData | ComplianceCheckData;

function tryParseStructured(content: string): StructuredData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && (parsed.type === "regulation_card" || parsed.type === "compliance_check")) {
      return parsed as StructuredData;
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-900 border border-gray-700 rounded p-2 my-1 text-xs font-mono text-gray-300 overflow-x-auto">
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Bullet list
    if (line.match(/^\s*[-*]\s+/)) {
      const content = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-1.5 ml-2">
          <span className="text-gray-500 mt-0.5 flex-shrink-0">*</span>
          <span>{applyInlineFormatting(content)}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const match = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (match) {
        elements.push(
          <div key={`ol-${i}`} className="flex items-start gap-1.5 ml-2">
            <span className="text-gray-500 mt-0.5 flex-shrink-0">{match[1]}.</span>
            <span>{applyInlineFormatting(match[2])}</span>
          </div>
        );
        continue;
      }
    }

    // Regular line
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {applyInlineFormatting(line)}
      </p>
    );
  }

  // Close unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre key="code-end" className="bg-gray-900 border border-gray-700 rounded p-2 my-1 text-xs font-mono text-gray-300 overflow-x-auto">
        {codeLines.join("\n")}
      </pre>
    );
  }

  return elements;
}

function applyInlineFormatting(text: string): React.ReactNode {
  // Bold: **text**
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold text-white">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

function detectCapaAction(content: string): boolean {
  const patterns = [
    /I recommend creating a corrective action/i,
    /create a CAPA/i,
    /corrective action.{0,30}should be/i,
    /recommend.{0,20}CAPA/i,
    /suggest.{0,20}corrective action/i,
    /initiate a CAPA/i,
  ];
  return patterns.some((p) => p.test(content));
}

function RegulationCard({
  data,
  onCreateCapa,
}: {
  data: StructuredData;
  onCreateCapa: () => void;
}) {
  const pct = data.requirements_total > 0
    ? Math.round((data.requirements_met / data.requirements_total) * 100)
    : 0;
  const barColor = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white truncate">{data.title}</h4>
          {data.citation && (
            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{data.citation}</span>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">
              {data.requirements_met}/{data.requirements_total} requirements met
            </span>
            <span className={`font-medium ${pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Covered items */}
        {data.covered && data.covered.length > 0 && (
          <div>
            {data.covered.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Missing items */}
        {data.missing && data.missing.length > 0 && (
          <div>
            {data.missing.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Create CAPAs button */}
        {data.missing && data.missing.length > 0 && (
          <button
            onClick={onCreateCapa}
            className="w-full text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded transition-colors font-medium mt-1"
          >
            Create CAPAs for gaps
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ token, currentPage, onClose, onNavigate, initialMessage, onInitialMessageSent }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  const toggleVoice = () => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) return;

    if (voiceListening && voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
      setVoiceListening(false);
      return;
    }

    const recognition = new (SpeechRecognitionAPI as new () => any)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setInput((prev) => prev ? prev + " " + transcript : transcript);
      }
    };

    recognition.onerror = () => setVoiceListening(false);
    recognition.onend = () => setVoiceListening(false);

    recognition.start();
    voiceRecognitionRef.current = recognition;
    setVoiceListening(true);
  };

  const fetchHistory = useCallback(() => {
    api<Message[]>("/api/chat/history", { token }).then(setMessages).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchHistory();
    api<{ prompts: string[] }>(`/api/chat/suggested-prompts?page=${currentPage}`, { token })
      .then((res) => setPrompts(res?.prompts || []))
      .catch(console.error);
  }, [token, currentPage, fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send initial message from AI prompt bar
  const initialMessageSentRef = useRef(false);
  useEffect(() => {
    if (initialMessage && !initialMessageSentRef.current && !loading) {
      initialMessageSentRef.current = true;
      sendMessage(initialMessage);
      if (onInitialMessageSent) onInitialMessageSent();
    }
  }, [initialMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await api<{ response: string }>("/api/chat/message", {
        method: "POST",
        body: { message: text, context: { page: currentPage } },
        token,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCapa = () => {
    if (onNavigate) {
      onNavigate("capas");
    }
  };

  const renderAssistantMessage = (content: string) => {
    // Try to parse as structured card data
    const structured = tryParseStructured(content);
    if (structured) {
      return <RegulationCard data={structured} onCreateCapa={handleCreateCapa} />;
    }

    // Render with markdown formatting + CAPA action detection
    const showCapaButton = detectCapaAction(content);

    return (
      <div className="space-y-1">
        <div className="whitespace-pre-wrap">{formatMarkdown(content)}</div>
        {showCapaButton && (
          <button
            onClick={handleCreateCapa}
            className="inline-flex items-center gap-1.5 text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-600/30 px-2.5 py-1 rounded transition-colors font-medium mt-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            Create CAPA
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-[380px] bg-navy-900 border-l border-navy-700 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy-700">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-safe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h2 className="font-semibold">EHS Advisor</h2>
          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            AI-powered
          </span>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 border border-red-800/50 transition-colors text-xs font-medium" title="Close chat">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
              <p className="text-sm text-gray-300 leading-relaxed">
                I&apos;m your EHS advisor. I&apos;ve analyzed your facility documents, incident history, and corrective actions across all 7 Bio-Techne sites. I know your framework gaps, your DART trends, and relevant OSHA and EPA regulations. Ask me anything about your EHS program.
              </p>
            </div>
            <div className="space-y-2">
              {["What are my biggest risks right now?", "Compare Denver vs Minneapolis safety performance", "Why is our DART rate trending up in CY26?", "Help me prepare for the next ISO 14001 audit"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="block w-full text-left text-sm bg-navy-800 hover:bg-navy-700 border border-navy-700 rounded-lg px-3 py-2 text-gray-300 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id || `msg-${i}`}
            className={`text-sm ${
              msg.role === "user"
                ? "bg-safe/10 border border-green-900 rounded-lg p-3 ml-8"
                : "bg-navy-800 rounded-lg p-3 mr-4"
            }`}
          >
            {msg.role === "assistant" ? (
              renderAssistantMessage(msg.content)
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-navy-800 rounded-lg p-3 mr-4">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-navy-700">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about EHS..."
            className="input-field flex-1 text-sm"
            disabled={loading}
          />
          <button
            type="button"
            onClick={toggleVoice}
            title={voiceListening ? "Stop recording" : "Voice input"}
            className={`px-2 rounded-lg transition-all ${
              voiceListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-navy-800 text-gray-400 hover:text-white hover:bg-navy-700"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <button type="submit" className="btn-primary px-3" disabled={loading || !input.trim()}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
