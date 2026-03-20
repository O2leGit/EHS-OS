"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface ChatPanelProps {
  token: string;
  currentPage: string;
  onClose: () => void;
}

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

export default function ChatPanel({ token, currentPage, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(() => {
    api<Message[]>("/api/chat/history", { token }).then(setMessages).catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchHistory();
    api<{ prompts: string[] }>(`/api/chat/suggested-prompts?page=${currentPage}`, { token })
      .then((res) => setPrompts(res.prompts))
      .catch(console.error);
  }, [token, currentPage, fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[380px] bg-navy-900 border-l border-navy-700 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-safe rounded-full" />
          <h2 className="font-semibold">EHS Expert</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">How can I help with your EHS program?</p>
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="block w-full text-left text-sm bg-navy-800 hover:bg-navy-700 border border-navy-700 rounded-lg px-3 py-2 text-gray-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? "bg-safe/10 border border-green-900 rounded-lg p-3 ml-8"
                : "bg-navy-800 rounded-lg p-3 mr-4"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
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
