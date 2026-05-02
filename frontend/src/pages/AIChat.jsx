import { useState, useRef, useEffect } from "react";

const AI_RESPONSES = {
  "Produk mana yang paling berisiko stockout minggu ini?": {
    text: "Berdasarkan analisa data saat ini, berikut 5 produk paling berisiko stockout minggu ini:",
    cards: [
      { id:"PRD-0821", store:"S-07", info:"Stok: 42 · Demand: 89/hari", risk:"High" },
      { id:"PRD-1432", store:"S-03", info:"Stok: 18 · Demand: 55/hari", risk:"High" },
      { id:"PRD-3301", store:"S-01", info:"Stok: 55 · Demand: 110/hari", risk:"High" },
    ],
    note:"Rekomendasi: segera lakukan reorder untuk PRD-0821 dan PRD-1432 — stok tidak cukup menutup lead time supplier.",
  },
  "Store mana yang perlu reorder sekarang?": {
    text: "Ada 3 store yang butuh reorder segera berdasarkan formula: stok / demand ≤ lead_time",
    cards: [
      { id:"S-07", store:"PRD-0821, PRD-3456", info:"5 hari lead time · supplier score 62", risk:"High" },
      { id:"S-03", store:"PRD-1432",           info:"7 hari lead time · supplier score 71", risk:"High" },
      { id:"S-11", store:"PRD-0093, PRD-1567", info:"4 hari lead time · supplier score 58", risk:"High" },
    ],
    note:"Supplier S-07 memiliki reliability score 62 — pertimbangkan backup supplier untuk order darurat.",
  },
  "Gimana pengaruh promosi terhadap demand?": {
    text: "Analisa dari seluruh data menunjukkan promosi aktif meningkatkan demand rata-rata +34% dibanding hari biasa:",
    cards: [
      { id:"Promo aktif", store:"Avg demand: 98 unit/hari",  info:"naik 34% dari baseline", risk:"Medium" },
      { id:"No promo",    store:"Avg demand: 73 unit/hari",  info:"baseline normal",         risk:"Low"    },
    ],
    note:"Perhatian: 3 produk dengan promo aktif saat ini justru berisiko stockout karena demand spike tidak diantisipasi.",
  },
  "Tampilkan summary stok hari ini": {
    text: "Ringkasan inventory per hari ini (30 Apr 2026):",
    cards: [
      { id:"Total produk",   store:"2.847 items aktif",   info:"di 12 store",          risk:"Low" },
      { id:"Produk kritis",  store:"147 items < 50 stok", info:"butuh perhatian",       risk:"High" },
      { id:"Avg stok/produk",store:"142 unit rata-rata",  info:"di semua store",        risk:"Low" },
    ],
    note:"Demand harian agregat: 1.204 unit · Avg supplier score: 83.4 · 12 store aktif",
  },
  "Supplier mana yang reliability score-nya rendah?": {
    text: "4 supplier dengan reliability score di bawah 70 — perlu dipantau ketat:",
    cards: [
      { id:"SUP-003", store:"S-11, S-07", info:"Score: 58 — sangat rendah",  risk:"High"   },
      { id:"SUP-007", store:"S-03",       info:"Score: 55 — sangat rendah",  risk:"High"   },
      { id:"SUP-012", store:"S-01",       info:"Score: 67 — di bawah rata",  risk:"Medium" },
    ],
    note:"Pertimbangkan diversifikasi supplier untuk store S-11 dan S-07 yang paling terdampak.",
  },
};

const DEFAULT_RESPONSE = {
  text: "Pertanyaan bagus! Di versi production, saya akan query langsung ke database PostgreSQL dan memberikan jawaban berbasis data real. Coba salah satu quick prompt di bawah untuk lihat demo!",
  cards: [],
  note: "Fitur ini akan terhubung ke endpoint FastAPI /api/ai/query dan menggunakan data Kaggle kamu.",
};

const QUICK_PROMPTS = [
  "Produk mana yang paling berisiko stockout minggu ini?",
  "Store mana yang perlu reorder sekarang?",
  "Gimana pengaruh promosi terhadap demand?",
  "Tampilkan summary stok hari ini",
  "Supplier mana yang reliability score-nya rendah?",
];

function RiskBadge({ risk }) {
  return <span className={`badge badge-${risk.toLowerCase()}`}>{risk}</span>;
}

function AvatarIcon() {
  return (
    <div style={{ width:30, height:30, minWidth:30, background:"#2a2050", border:"1px solid #7c6af7", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a599ff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
    </div>
  );
}

function AIMessage({ response }) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }} className="fade-up">
      <AvatarIcon />
      <div className="chat-bubble-ai">
        <p style={{ fontSize:13, lineHeight:1.7, color:"var(--text)", marginBottom: response.cards.length ? 10 : 0 }}>{response.text}</p>
        {response.cards.map((c, i) => (
          <div key={i} style={{ background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:8, padding:"10px 12px", marginTop:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--accent2)" }}>{c.id}</span>
              <RiskBadge risk={c.risk} />
            </div>
            <p style={{ fontSize:11, color:"var(--text2)", marginBottom:2 }}>{c.store}</p>
            <p style={{ fontSize:11, color:"var(--text3)" }}>{c.info}</p>
          </div>
        ))}
        {response.note && (
          <p style={{ fontSize:12, color:"var(--text2)", marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)", lineHeight:1.6 }}>{response.note}</p>
        )}
      </div>
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end" }} className="fade-up">
      <div className="chat-bubble-user">
        <p style={{ fontSize:13, lineHeight:1.6, color:"white" }}>{text}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <AvatarIcon />
      <div className="chat-bubble-ai" style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent2)", animation:`blink 1.2s ${i*0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  function send(text) {
    if (!text.trim() || loading) return;
    const userMsg = { type:"user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const response = AI_RESPONSES[text] || DEFAULT_RESPONSE;
      setMessages(prev => [...prev, { type:"ai", response }]);
      setLoading(false);
    }, 800 + Math.random() * 600);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", height:"calc(100vh - 56px)" }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>

      {/* Sidebar */}
      <div style={{ background:"var(--bg2)", borderRight:"1px solid var(--border)", padding:16, display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
        <p style={{ fontSize:11, color:"var(--text2)", fontFamily:"var(--mono)", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Recent chats</p>
        {[
          { label:"Produk berisiko minggu ini", time:"Today" },
          { label:"Pengaruh cuaca terhadap stok", time:"Yesterday" },
          { label:"Reorder suggestion S-07", time:"2 days ago" },
        ].map((c, i) => (
          <div key={i} style={{ borderRadius:8, padding:"10px 12px", cursor:"pointer", background: i===0 ? "var(--surface)" : "transparent", border: i===0 ? "1px solid var(--border2)" : "1px solid transparent", opacity: i===0 ? 1 : 0.55 }}>
            <p style={{ fontSize:11, color:"var(--text2)", fontFamily:"var(--mono)", marginBottom:2 }}>{c.time}</p>
            <p style={{ fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.label}</p>
          </div>
        ))}
        <div style={{ marginTop:"auto", paddingTop:12, borderTop:"1px solid var(--border)" }}>
          <button className="btn btn-ghost" style={{ width:"100%", fontSize:12 }} onClick={() => setMessages([])}>+ New chat</button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ display:"flex", flexDirection:"column", background:"var(--bg)" }}>

        {/* Header */}
        <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <AvatarIcon />
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:"var(--accent2)" }}>StockSense AI</p>
              <p style={{ fontSize:11, color:"var(--text2)", fontFamily:"var(--mono)" }}>Connected to inventory data</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, background:"var(--green)", borderRadius:"50%" }} />
            <span style={{ fontSize:11, color:"var(--text2)", fontFamily:"var(--mono)" }}>API online</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          {messages.length === 0 && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <AvatarIcon />
              <div className="chat-bubble-ai">
                <p style={{ fontSize:13, lineHeight:1.7, color:"var(--text)", marginBottom:12 }}>
                  Halo! Saya <strong style={{ color:"var(--accent2)" }}>StockSense AI</strong> — siap bantu analisa inventory kamu. Tanya apa aja soal stok, demand, risiko stockout, atau saran reorder.
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {QUICK_PROMPTS.slice(0,3).map(q => (
                    <button key={q} onClick={() => send(q)} className="btn btn-ghost" style={{ fontSize:11, borderRadius:20, color:"var(--accent2)", borderColor:"var(--accent3)", padding:"4px 10px" }}>{q.slice(0,28)}... ↗</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            m.type === "user"
              ? <UserMessage key={i} text={m.text} />
              : <AIMessage key={i} response={m.response} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding:"12px 20px", borderTop:"1px solid var(--border)" }}>
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {QUICK_PROMPTS.slice(0,3).map(q => (
              <button key={q} onClick={() => send(q)} className="btn btn-ghost" style={{ fontSize:11, padding:"5px 12px", borderRadius:20 }}>{q.slice(0,22)}...</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
              placeholder="Tanya soal inventory kamu... (Enter untuk kirim)"
              style={{ flex:1, resize:"none" }}
            />
            <button onClick={() => send(input)} className="btn btn-primary" style={{ height:42, width:42, padding:0, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p style={{ fontSize:11, color:"var(--text3)", fontFamily:"var(--mono)", marginTop:8, textAlign:"center" }}>Terhubung ke FastAPI backend · data real-time dari PostgreSQL</p>
        </div>
      </div>
    </div>
  );
}