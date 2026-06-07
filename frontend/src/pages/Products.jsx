import { useState, useEffect, useMemo } from "react";
import api from "../api";

const PER_PAGE = 10;

const EMPTY_PROD = {
  product_id: "",
  store_id: "S1",
  current_stock: "",
  daily_demand: "",
  lead_time_days: 3,
  supplier_reliability_score: 80,
  promotion_active: "No",
  weather_impact: "Low",
};

function SupplierBar({ score }) {
  const color = score >= 80 ? "var(--green)" : score >= 65 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
      <div style={{ width:40, height:4, borderRadius:2, background:"rgba(0,0,0,0.08)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${score}%`, background:color, borderRadius:2 }} />
      </div>
      <span style={{ fontFamily:"var(--mono)", fontSize:12 }}>{score}</span>
    </div>
  );
}

function isHighRisk(risk = "") {
  return risk === "Yes" || risk === "High";
}

// Format nama kolom custom jadi judul rapi: "supplier_name" -> "Supplier Name"
function prettyLabel(key) {
  return String(key).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldLabel({ children }) {
  return (
    <span style={{ fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.4px" }}>
      {children}
    </span>
  );
}

const inputStyle = {
  width:"100%", padding:"9px 12px", borderRadius:8,
  border:"1.5px solid #e2e8f0", fontSize:14, color:"#1e293b",
  background:"#fff", outline:"none", boxSizing:"border-box",
  transition:"border-color 0.15s",
};

export default function Products() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [search, setSearch]               = useState("");
  const [riskFilter, setRiskFilter]       = useState("");
  const [weatherFilter, setWeatherFilter] = useState("");
  const [promoFilter, setPromoFilter]     = useState("");
  const [sortKey, setSortKey]             = useState("");
  const [sortDir, setSortDir]             = useState(1);
  const [page, setPage]                   = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [newProd, setNewProd]     = useState(EMPTY_PROD);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState(null);

  const fetchProducts = () => {
    setLoading(true);
    api.get("/products", { params:{ limit:10000 } })
      .then((res) => {
        const d = res.data;
        setAllProducts(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const set = (field) => (e) => setNewProd((p) => ({ ...p, [field]: e.target.value }));

  const handleSaveProduct = async () => {
    if (!newProd.product_id.trim()) {
      setSaveMsg({ type:"error", text:"Product ID wajib diisi." }); return;
    }
    if (!newProd.current_stock || !newProd.daily_demand) {
      setSaveMsg({ type:"error", text:"Stock dan Daily Demand wajib diisi." }); return;
    }
    setSaving(true); setSaveMsg(null);

    const payload = {
      product_id:                 newProd.product_id.trim().toUpperCase(),
      store_id:                   newProd.store_id.trim() || "S1",
      current_stock:              Number(newProd.current_stock),
      daily_demand:               Number(newProd.daily_demand),
      lead_time_days:             Number(newProd.lead_time_days) || 3,
      supplier_reliability_score: Number(newProd.supplier_reliability_score) || 80,
      promotion_active:           newProd.promotion_active,
      weather_impact:             newProd.weather_impact,
    };

    try {
      const res = await api.post("/products", payload);
      setSaveMsg({ type:"success", text:`✅ ${res.data?.message ?? "Berhasil disimpan!"}` });
      setTimeout(() => {
        setNewProd(EMPTY_PROD); setSaveMsg(null); setShowModal(false); fetchProducts();
      }, 1200);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const text = typeof detail === "string" ? detail
        : Array.isArray(detail) ? detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(" | ")
        : err.message;
      setSaveMsg({ type:"error", text:`❌ ${text}` });
      console.error("Save error:", err.response || err);
    } finally {
      setSaving(false);
    }
  };

  // ── Deteksi kolom custom secara dinamis dari extra_data semua produk ────────
  const extraColumns = useMemo(() => {
    const seen = new Set();
    const order = [];
    for (const p of allProducts) {
      const ex = p?.extra_data;
      if (ex && typeof ex === "object") {
        for (const k of Object.keys(ex)) {
          if (!seen.has(k)) { seen.add(k); order.push(k); }
        }
      }
    }
    return order;
  }, [allProducts]);

  const filtered = useMemo(() => {
    let data = [...(allProducts || [])];
    data = data.filter((p) => {
      const matchSearch   = !search || p.product_id.toLowerCase().includes(search.toLowerCase()) || p.store_id.toLowerCase().includes(search.toLowerCase());
      const matchRisk     = !riskFilter || (riskFilter === "Yes" ? isHighRisk(p.stockout_risk) : !isHighRisk(p.stockout_risk));
      const matchWeather  = !weatherFilter || p.weather_impact === weatherFilter;
      const matchPromo    = !promoFilter   || p.promotion_active === promoFilter;
      return matchSearch && matchRisk && matchWeather && matchPromo;
    });
    if (sortKey) {
      data.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number") return (av - bv) * sortDir;
        if (typeof av === "string") return av.localeCompare(bv) * sortDir;
        return 0;
      });
    }
    return data;
  }, [allProducts, search, riskFilter, weatherFilter, promoFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";
  const highCount = filtered.filter((p) =>  isHighRisk(p.stockout_risk)).length;
  const lowCount  = filtered.filter((p) => !isHighRisk(p.stockout_risk)).length;

  // total kolom buat colSpan "No products found"
  const totalColSpan = 9 + extraColumns.length;

  if (loading) return <p style={{ color:'var(--text2)' }}>Loading products...</p>
  if (error)   return <p style={{ padding:24, color:"var(--red)" }}>Error: {error}</p>;

  return (
    <div className="page fade-up">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <h1>Products</h1>
          <p style={{ color:"var(--text2)" }}>
            Inventory management ({filtered.length}) items
            {extraColumns.length > 0 && (
              <span style={{ color:"var(--accent2)", fontWeight:600 }}>
                {" · "}{extraColumns.length} kolom custom
              </span>
            )}
          </p>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Download template */}
          <button
            className="btn btn-ghost"
            onClick={() => window.open("https://ivanaharsono-stocksense-api.hf.space/download-template", "_blank")}
            style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", border:"1px solid var(--border)", background:"#fff", color:"var(--text2)" }}
          >
            📋 Template
          </button>
          {/* Add product */}
          <button
            className="btn btn-primary"
            onClick={() => { setShowModal(true); setSaveMsg(null); }}
            style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background:"var(--accent)", color:"white" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add product
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search product ID or store..." style={{ width:220 }} />
        <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}>
          <option value="">All risk levels</option>
          <option value="Yes">High risk</option>
          <option value="No">Safe / Low risk</option>
        </select>
        <select value={weatherFilter} onChange={(e) => { setWeatherFilter(e.target.value); setPage(1); }}>
          <option value="">All weather</option>
          <option value="High">High impact</option>
          <option value="Medium">Medium impact</option>
          <option value="Low">Low impact</option>
        </select>
        <select value={promoFilter} onChange={(e) => { setPromoFilter(e.target.value); setPage(1); }}>
          <option value="">All promo</option>
          <option value="Yes">Promo active</option>
          <option value="No">No promo</option>
        </select>
        <button className="btn btn-ghost" onClick={() => { setSearch(""); setRiskFilter(""); setWeatherFilter(""); setPromoFilter(""); setPage(1); }}>
          Clear
        </button>
      </div>

      {/* ── Risk Summary ─────────────────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom:20 }}>
        <div className="metric-card" style={{ borderColor:"rgba(240,98,146,0.2)" }}>
          <div className="metric-label">High risk</div>
          <div className="metric-value" style={{ color:"var(--red)", fontSize:24 }}>{highCount}</div>
        </div>
        <div className="metric-card" style={{ borderColor:"rgba(45,212,160,0.2)" }}>
          <div className="metric-label">Safe stocks</div>
          <div className="metric-value" style={{ color:"var(--green)", fontSize:24 }}>{lowCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total (filtered)</div>
          <div className="metric-value" style={{ fontSize:24 }}>{filtered.length}</div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("product_id")}>PRODUCT ID{sortIcon("product_id")}</th>
                <th className="sortable" onClick={() => handleSort("store_id")}>STORE{sortIcon("store_id")}</th>
                <th className="sortable" style={{ textAlign:"right" }} onClick={() => handleSort("current_stock")}>STOCK{sortIcon("current_stock")}</th>
                <th className="sortable" style={{ textAlign:"right" }} onClick={() => handleSort("daily_demand")}>DEMAND{sortIcon("daily_demand")}</th>
                <th className="sortable" style={{ textAlign:"right" }} onClick={() => handleSort("lead_time_days")}>LEAD TIME{sortIcon("lead_time_days")}</th>
                <th className="sortable" style={{ textAlign:"right" }} onClick={() => handleSort("supplier_reliability_score")}>SUPPLIER{sortIcon("supplier_reliability_score")}</th>
                <th style={{ textAlign:"center" }}>WEATHER</th>
                <th style={{ textAlign:"center" }}>PROMO</th>
                <th style={{ textAlign:"center" }}>RISK</th>

                {/* Kolom custom dari Excel */}
                {extraColumns.map((col, i) => (
                  <th key={col} className={i === 0 ? "extra-col" : ""} style={{ whiteSpace:"nowrap" }}>
                    {prettyLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={totalColSpan} style={{ textAlign:"center", padding:32, color:"var(--text2)" }}>No products found</td></tr>
              ) : paginated.map((p) => {
                const daysLeft = p.daily_demand > 0 ? Math.round(p.current_stock / p.daily_demand) : 99;
                const riskHigh = isHighRisk(p.stockout_risk);
                const ex = p.extra_data || {};
                return (
                  <tr key={`${p.id ?? p.product_id}`}>
                    <td style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--accent2)" }}>{p.product_id}</td>
                    <td style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--text2)" }}>{p.store_id}</td>
                    <td style={{ textAlign:"right", fontFamily:"var(--mono)", color: p.current_stock < 50 ? "var(--red)" : p.current_stock < 100 ? "var(--amber)" : "var(--text)" }}>
                      {p.current_stock}
                    </td>
                    <td style={{ textAlign:"right", fontFamily:"var(--mono)" }}>{p.daily_demand}</td>
                    <td style={{ textAlign:"right", fontFamily:"var(--mono)", fontSize:12 }}>
                      {p.lead_time_days}d <span style={{ color:"var(--text2)", fontSize:11 }}>({daysLeft}d left)</span>
                    </td>
                    <td style={{ textAlign:"right" }}><SupplierBar score={p.supplier_reliability_score || 0} /></td>
                    <td style={{ textAlign:"center" }}>
                      <span className={`badge badge-${(p.weather_impact||"Low").toLowerCase()}`}>{p.weather_impact||"Low"}</span>
                    </td>
                    <td style={{ textAlign:"center" }}>
                      {p.promotion_active === "Yes"
                        ? <span className="badge badge-accent">Active</span>
                        : <span style={{ color:"var(--text3)", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ textAlign:"center" }}>
                      <span className={`badge badge-${riskHigh ? "yes" : "no"}`}>
                        {riskHigh ? "High" : "Safe"}
                      </span>
                    </td>

                    {/* Nilai kolom custom */}
                    {extraColumns.map((col, i) => {
                      const val = ex[col];
                      return (
                        <td
                          key={col}
                          className={i === 0 ? "extra-col" : ""}
                          style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--text2)", whiteSpace:"nowrap" }}
                        >
                          {val === undefined || val === null || val === ""
                            ? <span style={{ color:"var(--text3)" }}>—</span>
                            : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 24px", borderTop:"1px solid #e2e8f0", background:"#fff", borderRadius:"0 0 8px 8px" }}>
          <span style={{ fontSize:13, color:"#64748b" }}>
            Showing {filtered.length === 0 ? 0 : (page-1)*PER_PAGE+1} – {Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            {[["← Prev", () => setPage((p)=>Math.max(1,p-1)), page===1],
              ["Next →", () => setPage((p)=>Math.min(totalPages,p+1)), page>=totalPages||totalPages===0]
            ].map(([label, fn, disabled]) => (
              <button key={label} onClick={fn} disabled={disabled} style={{
                padding:"6px 14px", borderRadius:6, border:"1px solid #e2e8f0",
                background: disabled ? "#f8fafc" : "white",
                color: disabled ? "#cbd5e1" : "#334155",
                cursor: disabled ? "not-allowed" : "pointer", fontWeight:600,
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setNewProd(EMPTY_PROD); setSaveMsg(null); } }}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(2px)" }}
        >
          <div style={{ background:"#fff", borderRadius:16, width:380, padding:"28px 28px 24px", boxShadow:"0 20px 60px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column", gap:16 }}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <h3 style={{ margin:0, color:"#0f172a", fontSize:18, fontWeight:700 }}>Add / Update Product</h3>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#64748b" }}>
                  ID sudah ada → data diperbarui otomatis
                </p>
              </div>
              <button onClick={() => { setShowModal(false); setNewProd(EMPTY_PROD); setSaveMsg(null); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:20, lineHeight:1, padding:2 }}>✕</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <FieldLabel>Product ID *</FieldLabel>
              <input
                style={inputStyle} placeholder="cth: P999"
                value={newProd.product_id}
                onChange={(e) => setNewProd((p) => ({ ...p, product_id: e.target.value.toUpperCase() }))}
              />
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <FieldLabel>Store ID</FieldLabel>
              <input
                style={inputStyle} placeholder="cth: S101"
                value={newProd.store_id}
                onChange={(e) => setNewProd((p) => ({ ...p, store_id: e.target.value.toUpperCase() }))}
              />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Current Stock *</FieldLabel>
                <input type="number" min="0" style={inputStyle} placeholder="cth: 200" value={newProd.current_stock} onChange={set("current_stock")} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Daily Demand *</FieldLabel>
                <input type="number" min="0" style={inputStyle} placeholder="cth: 50" value={newProd.daily_demand} onChange={set("daily_demand")} />
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Lead Time (hari)</FieldLabel>
                <input type="number" min="1" style={inputStyle} placeholder="3" value={newProd.lead_time_days} onChange={set("lead_time_days")} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Supplier Score</FieldLabel>
                <input type="number" min="0" max="100" style={inputStyle} placeholder="80" value={newProd.supplier_reliability_score} onChange={set("supplier_reliability_score")} />
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Promosi</FieldLabel>
                <select style={inputStyle} value={newProd.promotion_active} onChange={set("promotion_active")}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <FieldLabel>Weather Impact</FieldLabel>
                <select style={inputStyle} value={newProd.weather_impact} onChange={set("weather_impact")}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            {saveMsg && (
              <div style={{
                padding:"10px 14px", borderRadius:8, fontSize:13,
                background: saveMsg.type === "error" ? "#fef2f2" : "#f0fdf4",
                color:      saveMsg.type === "error" ? "#dc2626"  : "#16a34a",
                border:     `1px solid ${saveMsg.type === "error" ? "#fecaca" : "#bbf7d0"}`,
              }}>
                {saveMsg.text}
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:4 }}>
              <button
                onClick={handleSaveProduct} disabled={saving}
                style={{
                  padding:"11px", borderRadius:8, border:"none", fontWeight:700, fontSize:14, cursor: saving ? "wait" : "pointer",
                  background: saving ? "#94a3b8" : "var(--accent)", color:"white", transition:"background 0.2s",
                }}
              >
                {saving ? "Menyimpan..." : "💾 Save"}
              </button>
              <button
                onClick={() => { setShowModal(false); setNewProd(EMPTY_PROD); setSaveMsg(null); }}
                style={{ padding:"11px", borderRadius:8, border:"1.5px solid #e2e8f0", fontWeight:700, fontSize:14, cursor:"pointer", background:"#f8fafc", color:"#64748b" }}
              >
                Batal
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}