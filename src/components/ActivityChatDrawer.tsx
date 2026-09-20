"use client";

import { useState, useRef, useEffect } from "react";
import { PlannedActivity } from "@/lib/schemas/preferences";
import { formatMaterial } from "@/lib/utils/formatters";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
}

/**
 * Convert markdown-flavored text to safe HTML string.
 * Handles **bold**, *italic*, \n newlines, and basic bullet lists.
 */
function parseMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic (single asterisk, but not double)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    // Line breaks
    .replace(/\n/g, "<br />")
    // Bullet points (lines starting with - or *)
    .replace(/^[\-\*] (.+)/gm, "<li>$1</li>")
    // Wrap consecutive li's in ul
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul style='margin:0.5rem 0 0.5rem 1rem;padding:0'>$1</ul>");
}

interface ActivityChatDrawerProps {
  activity: PlannedActivity;
  childAge: string;
  isOpen: boolean;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  "Why will my child find this activity fun?",
  "How can I get my child excited if they are reluctant?",
  "How can we do this in a small space with low mess?",
  "What questions can I ask to spark their imagination?",
];

export default function ActivityChatDrawer({
  activity,
  childAge,
  isOpen,
  onClose,
}: ActivityChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when drawer opens for a new activity
  useEffect(() => {
    if (isOpen) {
      const cleanTitle = activity.title.replace(/_/g, " ");
      setMessages([
        {
          id: "welcome",
          sender: "bot",
          text: `Hi! I'm your Sprout Activity Guide. Ask me anything about **${cleanTitle}**—how to set it up easily, tips for getting your ${childAge}-year-old excited, or how to adapt it with what you have at home!`,
        },
      ]);
    }
  }, [isOpen, activity, childAge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const res = await fetch("/api/planner/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity,
          childAge,
          question: textToSend.trim(),
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reach Sprout Coach");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: data.reply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot-" + Date.now(),
          sender: "bot",
          text: "I'm here to help! The key to this activity is keeping it low-pressure: introduce the materials casually, let your child lead the exploration, and celebrate their creative ideas along the way.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          height: "100%",
          background: "var(--color-cream)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            background: "white",
            borderBottom: "1px solid var(--color-stone-200)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>💬</span>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", margin: 0, color: "var(--color-stone-900)" }}>
                Ask Sprout Guide
              </h3>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--color-stone-500)", margin: "0.25rem 0 0 0" }}>
              Tailored to: {activity.title.replace(/_/g, " ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "1.25rem", padding: "0.25rem 0.5rem" }}
            aria-label="Close Chat"
          >
            ✕
          </button>
        </div>

        {/* Message stream */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: msg.sender === "user" ? "var(--color-sage-600)" : "white",
                  color: msg.sender === "user" ? "white" : "var(--color-stone-800)",
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                  boxShadow: msg.sender === "bot" ? "var(--shadow-sm)" : "none",
                  border: msg.sender === "bot" ? "1px solid var(--color-stone-200)" : "none",
                }}
                dangerouslySetInnerHTML={msg.sender === "bot" ? { __html: parseMarkdown(msg.text) } : undefined}
              >
                {msg.sender === "user" ? msg.text : undefined}
              </div>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-stone-400)", marginTop: "0.25rem", padding: "0 0.25rem" }}>
                {msg.sender === "user" ? "You" : "Sprout Coach"}
              </span>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-stone-500)", fontSize: "0.8125rem" }}>
              <span className="animate-spin">🌱</span> Sprout Guide is typing advice...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Starter suggestion chips */}
        {messages.length <= 2 && (
          <div style={{ padding: "0 1.25rem 0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {STARTER_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                style={{
                  fontSize: "0.75rem",
                  background: "white",
                  border: "1px solid var(--color-sage-300)",
                  color: "var(--color-sage-800)",
                  borderRadius: "9999px",
                  padding: "0.3rem 0.65rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                💡 {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div style={{ padding: "1rem", background: "white", borderTop: "1px solid var(--color-stone-200)" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            style={{ display: "flex", gap: "0.5rem" }}
          >
            <input
              type="text"
              placeholder="Ask anything about this activity..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              className="input"
              style={{ flex: 1, fontSize: "0.875rem" }}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="btn btn-primary btn-sm"
              style={{ padding: "0 1rem" }}
            >
              Send
            </button>
          </form>
          <p style={{ fontSize: "0.6875rem", color: "var(--color-stone-400)", textAlign: "center", marginTop: "0.5rem", marginBottom: 0 }}>
            Sprout Coach provides play ideas only, not medical, pediatric, or developmental diagnostic advice.
          </p>
        </div>
      </div>
    </div>
  );
}
