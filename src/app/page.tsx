"use client";
import React, { useState, useRef, useEffect } from "react";

type BotReply = {
  summary?: string;
  explanation?: string;
  roadmap?: {
    stepName: string;
    action: string;
    timeEstimate: string;
    resources: { title: string; url: string }[];
    exercise: string;
  }[];
};

type Message = {
  id: string;
  from: "user" | "bot";
  text: string;
  replyObj?: BotReply;
  quickReplies?: string[];
};

const MODE_LABELS = {
  eli5: "Explain Like I'm 5",
  normal: "Normal",
  expert: "Expert",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m1",
      from: "bot",
      text: "👋 Hi — I'm your Explain & Learn bot! Ask me anything and choose how you'd like it explained.",
      quickReplies: ["Yes", "No", "popular topics?"],
    },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"eli5" | "normal" | "expert">("eli5");
  const [wantRoadmap, setWantRoadmap] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const appendMessage = (m: Message) => setMessages((prev) => [...prev, m]);

  async function send(text?: string) {
    const messageToSend = text || input;
    if (!messageToSend.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), from: "user", text: messageToSend };
    appendMessage(userMsg);
    setLoading(true);

    try {
      const r = await fetch("/api/chatai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, mode, wantRoadmap }),
      });
      const data = await r.json();

      if (r.ok && typeof data.explanation === "string") {
        appendMessage({
          id: "b-" + Date.now(),
          from: "bot",
          text: "",
          replyObj: {
            explanation: data.explanation,
            roadmap: Array.isArray(data.roadmap) ? data.roadmap : undefined,
          },
        });
      } else {
        appendMessage({
          id: "b-" + Date.now(),
          from: "bot",
          text: `❌ Error: ${data?.error || "Unknown"}`,
        });
      }
    } catch {
      appendMessage({ id: "err-" + Date.now(), from: "bot", text: "🌐 Network error." });
    } finally {
      setInput("");
      setLoading(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="page">
      <main className="chat-widget">
        {/* Header */}
        <header className="chat-header">
          <div className="bot-info">
            <img src="/chatpic.png" alt="Bot" className="bot-avatar" />
            <h2>Explain & Learn Bot</h2>
          </div>
          <button className="refresh-btn" onClick={() => window.location.reload()}>
            ⟳
          </button>
        </header>

        {/* Mode selector */}
        <div className="mode-bar">
          {(["eli5", "normal", "expert"] as const).map((m) => (
            <button
              key={m}
              className={`mode-btn ${mode === m ? "active" : ""}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
          <label className="roadmap-toggle">
            <input
              type="checkbox"
              checked={wantRoadmap}
              onChange={(e) => setWantRoadmap(e.target.checked)}
            />
            Roadmap
          </label>
        </div>

        {/* Messages */}
        <section className="messages">
          {messages.map((m) => (
            <div key={m.id} className={`message ${m.from}`}>
              <div className="bubble">
                {m.from === "bot" && m.replyObj ? (
                  <div>
                    {/* Display explanation */}
                    {m.replyObj.explanation && (
                      <div style={{ marginBottom: m.replyObj.roadmap ? 10 : 0 }}>
                        {m.replyObj.explanation}
                      </div>
                    )}
                    {/* Display roadmap if present */}
                    {m.replyObj.roadmap && Array.isArray(m.replyObj.roadmap) && m.replyObj.roadmap.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Roadmap:</div>
                        <ol style={{ paddingLeft: 18 }}>
                          {m.replyObj.roadmap.map((step, idx) => (
                            <li key={idx} style={{ marginBottom: 10 }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{step.stepName}</span>
                                <span style={{ marginLeft: 8, color: "#6366f1" }}>{step.action}</span>
                              </div>
                              <div style={{ fontSize: "0.95em", color: "#555" }}>
                                <strong>Time:</strong> {step.timeEstimate}
                              </div>
                              {step.resources && step.resources.length > 0 && (
                                <div style={{ fontSize: "0.95em", marginTop: 2 }}>
                                  <strong>Resources:</strong>{" "}
                                  {step.resources.map((res, i) => (
                                    <span key={i}>
                                      <a
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#4f46e5" }}
                                      >
                                        {res.title}
                                      </a>
                                      {i < step.resources.length - 1 ? ", " : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div style={{ fontSize: "0.95em", marginTop: 2 }}>
                                <strong>Exercise:</strong> {step.exercise}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  m.text
                )}
              </div>
              {m.quickReplies && (
                <div className="quick-replies">
                  {m.quickReplies.map((qr, i) => (
                    <button key={i} onClick={() => send(qr)}>
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </section>

        {/* Footer */}
        <footer className="chat-footer">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ color: "#4f46e5" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading) send();
              }
            }}
          />
          <button onClick={() => send()} disabled={loading}>
            ➤
          </button>
        </footer>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #eef2ff, #f5f3ff);
          padding: 20px;
        }

        .chat-widget {
          width: 100%;
          max-width: 1000px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          animation: fadeIn 0.4s ease;
        }

        /* HEADER */
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: linear-gradient(90deg, #f9f9ff, #eef2ff);
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .bot-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bot-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #4f46e5;
        }

        .chat-header h2 {
          color: #4f46e5;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .refresh-btn {
          background: none;
          font-size: 20px;
          cursor: pointer;
          color: #4f46e5;
          transition: transform 0.2s;
        }
        .refresh-btn:hover {
          transform: rotate(90deg);
        }

        /* MODE BAR */
        .mode-bar {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          background: #fafafa;
        }

        .mode-btn {
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid #4f46e5;
          background: white;
          color: #4f46e5;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-btn:hover {
          background: #eef2ff;
        }

        .mode-btn.active {
          background: #4f46e5;
          color: white;
          box-shadow: 0 3px 8px rgba(79, 70, 229, 0.3);
        }

        .roadmap-toggle {
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          color: #4f46e5;
        }

        /* MESSAGES */
        .messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: #fafafa;
        }

        .message {
          margin-bottom: 14px;
          animation: slideUp 0.25s ease forwards;
        }

        .bubble {
          display: inline-block;
          max-width: 75%;
          padding: 12px 16px;
          border-radius: 18px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
          line-height: 1.4;
        }

        .message.user {
          text-align: right;
        }
        .message.user .bubble {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
        }
        .message.bot .bubble {
          background: #eef2ff;
          color: #1e1e1e;
        }

        /* QUICK REPLIES */
        .quick-replies {
          display: flex;
          gap: 6px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .quick-replies button {
          background: white;
          border: 1px solid #4f46e5;
          color: #4f46e5;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .quick-replies button:hover {
          background: #4f46e5;
          color: white;
        }

        /* FOOTER */
        .chat-footer {
          display: flex;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          background: white;
        }
        .chat-footer input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 20px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          color: #1e293b;
        }
        .chat-footer button {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          font-size: 18px;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .chat-footer button:hover {
          transform: scale(1.05);
        }

        /* ANIMATIONS */
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
}
