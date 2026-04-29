"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS, Cubby, type CubbyMood } from "~/lib/theme";
import { Ic } from "./icons";

/**
 * Cubby — floating warehouse assistant. Bottom-left of every dashboard
 * page. Collapsed = mascot button; expanded = small chat panel pinned
 * above the button. Conversation lives in component state only (resets
 * on reload) — fine for an MVP, can move to localStorage later.
 */

type Message = { role: "user" | "assistant"; content: string };

const HISTORY_CAP = 18; // server caps at 20; keep one slot for the new message + buffer

const SUGGESTIONS = [
  "How many pallets are stored?",
  "How do I run the monthly billing report?",
  "What's the difference between a customer and a supplier?",
];

export function CubbyChat() {
  const t = theme;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry — I hit a snag: ${err.message}`,
        },
      ]);
    },
  });

  // Mood reflects the current state — thinking while a reply is in
  // flight, wow on the latest assistant reply, otherwise happy / sleepy.
  const mood: CubbyMood = useMemo(() => {
    if (send.isPending) return "think";
    if (!open && messages.length === 0) return "sleep";
    return "happy";
  }, [send.isPending, open, messages.length]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, send.isPending]);

  // Focus input when opened.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleSend(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || send.isPending) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    // Cap history sent to the server — keep most recent N.
    const trimmed = next.slice(-HISTORY_CAP);
    send.mutate({ messages: trimmed });
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Cubby"
          style={{
            position: "fixed",
            bottom: 92,
            left: 20,
            width: 360,
            maxWidth: "calc(100vw - 40px)",
            height: 520,
            maxHeight: "calc(100vh - 120px)",
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 18,
            boxShadow: "0 24px 60px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08)",
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: FONTS.sans,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderBottom: `1.5px solid ${t.border}`,
              background: t.surfaceAlt,
            }}
          >
            <Cubby size={32} mood={mood} t={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.ink }}>
                Cubby
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>
                Your warehouse assistant
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Cubby"
              onClick={() => setOpen(false)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: t.muted,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ic.X size={14} />
            </button>
          </div>

          <div
            ref={scrollerRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "14px 14px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <>
                <div
                  style={{
                    fontSize: 13,
                    color: t.body,
                    background: t.surfaceAlt,
                    padding: "10px 12px",
                    borderRadius: 12,
                    alignSelf: "flex-start",
                    maxWidth: "85%",
                  }}
                >
                  Hi! I&apos;m Cubby. Ask me anything about your warehouse —
                  pallets, orders, customers, billing, or how to do
                  something in the app.
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      color: t.muted,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    Try asking
                  </div>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s)}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: t.surface,
                        border: `1.5px solid ${t.border}`,
                        fontSize: 12.5,
                        color: t.body,
                        fontFamily: FONTS.sans,
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? t.primary : t.surfaceAlt,
                  color: m.role === "user" ? t.primaryText : t.body,
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.45,
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.content}
              </div>
            ))}
            {send.isPending && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: t.surfaceAlt,
                  color: t.muted,
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                Cubby is thinking…
              </div>
            )}
          </div>

          <div
            style={{
              padding: 10,
              borderTop: `1.5px solid ${t.border}`,
              background: t.surface,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Ask Cubby…"
              style={{
                flex: 1,
                resize: "none",
                padding: "8px 12px",
                borderRadius: 10,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                fontFamily: FONTS.sans,
                fontSize: 13,
                color: t.ink,
                maxHeight: 120,
                lineHeight: 1.4,
              }}
            />
            <button
              type="button"
              aria-label="Send"
              onClick={() => handleSend()}
              disabled={!draft.trim() || send.isPending}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: draft.trim() ? t.primary : t.surfaceAlt,
                color: draft.trim() ? t.primaryText : t.muted,
                cursor: draft.trim() ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Ic.Spark size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Hide Cubby" : "Open Cubby"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          background: t.primary,
          border: `2px solid ${t.primaryDeep}`,
          boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          cursor: "pointer",
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <Cubby size={42} mood={mood} t={t} />
      </button>
    </>
  );
}
