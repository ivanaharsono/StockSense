import { useState, useEffect } from "react";
import api from "../api";

// Field target + label tampilan
const TARGETS = [
  { key: "product_id",                 label: "Product ID",     required: true },
  { key: "store_id",                   label: "Store",          required: false },
  { key: "current_stock",              label: "Current Stock",  required: false },
  { key: "daily_demand",               label: "Daily Demand",   required: false },
  { key: "lead_time_days",             label: "Lead Time (days)", required: false },
  { key: "supplier_reliability_score", label: "Supplier Score", required: false },
];

export default function ColumnMapper({ file, onClose, onDone }) {
  const [analyzing, setAnalyzing] = useState(true);
  const [columns, setColumns]     = useState([]);
  const [sample, setSample]       = useState([]);
  const [mapping, setMapping]     = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError]         = useState(null);

  // 1. Analisa file → tebakan mapping
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      setAnalyzing(true); setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await api.post("/upload/analyze", fd);
        if (cancelled) return;
        setColumns(res.data.columns || []);
        setSample(res.data.sample_rows || []);
        setMapping(res.data.suggested_mapping || {});
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || "Failed to analyze file.");
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const setField = (key) => (e) =>
    setMapping((m) => ({ ...m, [key]: e.target.value || null }));

  // 2. Konfirmasi → import
  const handleImport = async () => {
    if (!mapping.product_id) { setError("Please map the Product ID column."); return; }
    setImporting(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      const res = await api.post("/upload/confirm", fd);
      onDone?.(file.name, res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  // kolom yang belum dipetakan → bakal jadi kolom custom
  const mappedCols = new Set(Object.values(mapping).filter(Boolean));
  const extraCols  = columns.filter((c) => !mappedCols.has(c));

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose?.(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)",
               zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "88vh",
                    overflowY: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Map your columns</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              We detected your columns automatically — adjust if needed.
            </p>
          </div>
          <button onClick={() => !importing && onClose?.()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 20, padding: 2 }}>✕</button>
        </div>

        {analyzing ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
            🤖 Analyzing columns...
          </div>
        ) : (
          <>
            {/* file info */}
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", fontSize: 12,
                          color: "#475569", margin: "14px 0 18px" }}>
              📄 <strong>{file?.name}</strong> · {columns.length} columns found
            </div>

            {/* mapping rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TARGETS.map((t) => (
                <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 140, fontSize: 13, fontWeight: 600, color: "#334155", flexShrink: 0 }}>
                    {t.label}{t.required && <span style={{ color: "#ef4444" }}> *</span>}
                  </span>
                  <select
                    value={mapping[t.key] || ""}
                    onChange={setField(t.key)}
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13,
                             border: `1.5px solid ${t.required && !mapping[t.key] ? "#fecaca" : "#e2e8f0"}`,
                             background: "#fff", color: "#1e293b", outline: "none" }}
                  >
                    <option value="">— none —</option>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* note kolom custom */}
            {extraCols.length > 0 && (
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 16, lineHeight: 1.6 }}>
                <strong style={{ color: "var(--accent2)" }}>{extraCols.length} extra column(s)</strong> ({extraCols.join(", ")})
                {" "}will be kept as custom columns. Unmapped fields use safe defaults.
              </p>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
                            fontSize: 13, padding: "10px 12px", borderRadius: 8, marginTop: 16 }}>
                {error}
              </div>
            )}

            {/* actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
              <button onClick={handleImport} disabled={importing || !mapping.product_id}
                style={{ padding: "11px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14,
                         cursor: importing || !mapping.product_id ? "not-allowed" : "pointer",
                         background: importing || !mapping.product_id ? "#cbd5e1" : "var(--accent)", color: "#fff" }}>
                {importing ? "Importing..." : "Import Data"}
              </button>
              <button onClick={() => !importing && onClose?.()}
                style={{ padding: "11px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontWeight: 700,
                         fontSize: 14, cursor: "pointer", background: "#f8fafc", color: "#64748b" }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
