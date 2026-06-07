import { useState, useRef, useEffect } from "react";

const API = "https://ivanaharsono-stocksense-api.hf.space";

function AvatarIcon() {
  return (
    <div style={{
      width: 32, height: 32, minWidth: 32,
      background: "var(--accent3)",
      border: "1.5px solid var(--accent)",
      borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <AvatarIcon />
      <div className="chat-bubble-ai" style={{ padding:"12px 16px" }}>
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width:6, height:6, borderRadius:"50%", background:"var(--accent)",
              animation:`blink 1.2s ${i*0.2}s infinite`
            }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { type:"user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        type: "ai",
        text: data.reply || "Maaf, tidak ada jawaban dari AI.",
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        type: "ai",
        text: "⚠️ Gagal terhubung ke backend. Coba lagi dalam beberapa detik.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const quickPrompts = [
    "Produk mana yang berisiko stockout?",
    "Analisa stok hari ini",
    "Pengaruh cuaca terhadap demand?",
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 64px)", background:"var(--bg)" }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>

      {/* ── Header ── */}
      <div style={{
        padding:"14px 24px", borderBottom:"1px solid var(--border)",
        background:"var(--bg2)", display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <AvatarIcon />
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:"var(--accent2)", margin:0 }}>StockSense AI</p>
            <p style={{ fontSize:11, color:"var(--text2)", margin:0 }}>Powered by Groq · Llama 3.1</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, background:"var(--green)", borderRadius:"50%" }}/>
          <span style={{ fontSize:11, color:"var(--text2)" }}>API online</span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Welcome */}
        {messages.length === 0 && (
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <AvatarIcon />
            <div className="chat-bubble-ai" style={{ maxWidth:520 }}>
              <p style={{ fontSize:13, lineHeight:1.8, color:"var(--text)", marginBottom:14 }}>
                Halo! Saya <strong style={{ color:"var(--accent2)" }}>StockSense AI</strong> — siap bantu analisa inventory kamu secara real-time. Tanya apa aja soal stok, demand, risiko stockout, atau saran reorder.
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {quickPrompts.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    style={{
                      fontSize:11, padding:"5px 12px", borderRadius:20, cursor:"pointer",
                      background:"var(--accent3)", color:"var(--accent2)",
                      border:"1px solid var(--accent)", fontWeight:600,
                    }}
                  >
                    {q} ↗
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((m, i) => (
          m.type === "user" ? (
            <div key={i} style={{ display:"flex", justifyContent:"flex-end" }}>
              <div className="chat-bubble-user" style={{ maxWidth:480, fontSize:13, lineHeight:1.7 }}>
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <AvatarIcon />
              <div className="chat-bubble-ai" style={{ maxWidth:560, fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                {m.text}
              </div>
            </div>
          )
        ))}

        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)", background:"var(--bg2)" }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end", maxWidth:800, margin:"0 auto" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="Tanya soal inventory kamu... (Enter untuk kirim)"
            style={{
              flex:1, resize:"none", padding:"10px 14px", borderRadius:10,
              border:"1.5px solid var(--border)", fontSize:13, lineHeight:1.6,
              fontFamily:"var(--font)", outline:"none", background:"#fff", color:"var(--text)",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              width:44, height:44, borderRadius:10, border:"none", cursor: loading ? "wait" : "pointer",
              background: loading || !input.trim() ? "#cbd5e1" : "var(--accent)",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"background 0.2s", flexShrink:0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p style={{ fontSize:11, color:"var(--text3)", textAlign:"center", marginTop:8 }}>
          Terhubung ke FastAPI · Groq Llama 3.1 · Data real-time dari database
        </p>
      </div>
    </div>
  );
}