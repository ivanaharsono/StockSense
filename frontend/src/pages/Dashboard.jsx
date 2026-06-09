import React, { useState, useEffect, useRef } from 'react';
import api, { getAiPrediction } from '../api';
import { getWorkspaceId } from "../api";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid rgba(240, 98, 146, 0.3)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 12px rgba(240, 98, 146, 0.1)",
    }}>
      <p style={{ color: "#8888aa", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats]             = useState(null);
  const [trendData, setTrendData]     = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeTab, setActiveTab]     = useState('high');

  // AI Predict
  const [aiResult, setAiResult]   = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [checkId, setCheckId]     = useState('');

  // AI Retrain
  const [retraining, setRetraining]       = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);

  // Upload
  const [uploading, setUploading]         = useState(false);
  const fileInputRef                      = useRef(null);
  const [uploadedFile, setUploadedFile]   = useState(
    localStorage.getItem("lastUploadedExcel") || ""
  );

  // ── Fetch dashboard ────────────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      if (!stats) setLoading(true);
      const [statsRes, trendRes, weatherRes] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/dashboard/trend"),
        api.get("/analytics/weather"),
      ]);
      setStats(statsRes.data);
      setTrendData(trendRes.data);

      if (statsRes.data.total_products === 0) {
        localStorage.removeItem("lastUploadedExcel");
        setUploadedFile("");
      }

      setWeatherData(weatherRes.data.map((w) => ({
        weather: w.weather, high: w.high, low: w.low,
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh setiap 30 detik
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Upload file ────────────────────────────────────────────────────────────
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const response = await fetch(`https://ivanaharsono-stocksense-api.hf.space/upload-data`, {
        method: "POST", body: formData,
        headers: { "X-Workspace-Id": getWorkspaceId() },
      });
      if (response.ok) {
        localStorage.setItem("lastUploadedExcel", file.name);
        setUploadedFile(file.name);
        alert("🎉 Data berhasil di-upload!");
        fetchDashboardData();
      } else {
        alert("Gagal upload. Pastikan format kolom sesuai.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
      fileInputRef.current.value = null;
    }
  };

  // ── AI Predict ─────────────────────────────────────────────────────────────
  const handleCheckAI = async () => {
    if (!checkId.trim()) { alert("Masukkan Product ID dulu."); return; }
    setLoadingAi(true);
    setAiResult(null);
    try {
      const result = await getAiPrediction(checkId);
      setAiResult(result);
    } catch (err) {
      alert("AI gagal ambil data. Cek apakah ID sudah benar?");
    } finally {
      setLoadingAi(false);
    }
  };

  // ── AI Retrain ─────────────────────────────────────────────────────────────
  const handleRetrain = async () => {
    if (!window.confirm("Re-train AI dengan semua data saat ini?\nProses ini butuh beberapa detik.")) return;
    setRetraining(true);
    setRetrainResult(null);
    try {
      const res = await api.post("/ai/retrain");
      setRetrainResult({ type: "success", data: res.data });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setRetrainResult({ type: "error", msg });
    } finally {
      setRetraining(false);
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="page fade-up" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'80vh' }}>
      <p style={{ color:'var(--red)' }}>Gagal memuat data: {error}</p>
    </div>
  );
  if (loading || !stats) return (
    <div className="page fade-up" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'80vh' }}>
      <p style={{ color:'var(--text2)' }}>Synchronizing data...</p>
    </div>
  );

  const highRiskProducts = stats.high_risk_products ?? [];
  const lowRiskProducts  = stats.low_risk_products  ?? [];

  return (
    <div className="page fade-up">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24 }}>
        <div>
          <h1>Inventory Overview</h1>
          <p>Real-time data with {stats.total_products?.toLocaleString() ?? "—"} records synced</p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {/* Label file aktif */}
          {uploadedFile ? (
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              background:"#f0fdf4", border:"1px solid #bbf7d0",
              borderRadius:8, padding:"7px 12px",
              fontSize:12, color:"#15803d", fontWeight:600, maxWidth:180,
            }}>
              <span>📄</span>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {uploadedFile}
              </span>
            </div>
          ) : (
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              background:"#fef9ec", border:"1px solid #fde68a",
              borderRadius:8, padding:"7px 12px",
              fontSize:12, color:"#92400e", fontWeight:600,
            }}>
              <span>⚠️</span><span>Belum ada data</span>
            </div>
          )}

          {/* Export */}
          <button
            onClick={() => {
              const fname = encodeURIComponent(uploadedFile || "stock");
              window.open(`https://ivanaharsono-stocksense-api.hf.space/export-data?filename=${fname}&ws=${getWorkspaceId()}`, "_blank");
            }}
            style={{ background:'#10b981', color:'white', padding:'9px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:700, fontSize:13 }}
          >
            📥 Export Excel
          </button>

          {/* Upload */}
          <input type="file" accept=".csv,.xlsx" ref={fileInputRef} style={{ display:'none' }} onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current.click()} disabled={uploading}
            style={{ background:'var(--accent)', color:'white', padding:'9px 16px', borderRadius:'8px', border:'none', cursor: uploading ? 'wait' : 'pointer', fontWeight:700, fontSize:13, boxShadow:'0 4px 10px rgba(216,27,96,0.25)' }}>
            {uploading ? "Memproses..." : "📂 Upload Data"}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ───────────────────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        <div className="metric-card">
          <div className="metric-label">Total Products</div>
          <div className="metric-value">{stats.total_products?.toLocaleString()}</div>
          <div className="metric-sub" style={{ color:"var(--green)" }}>in active catalog</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Daily Demand</div>
          <div className="metric-value">{stats.avg_daily_demand?.toLocaleString()}</div>
          <div className="metric-sub" style={{ color:"var(--amber)" }}>across all stores</div>
        </div>
        <div className="metric-card" style={{ borderColor:"rgba(240,98,146,0.3)" }}>
          <div className="metric-label">Stockout Risk</div>
          <div className="metric-value" style={{ color:"var(--red)" }}>{stats.stockout_risk_count}</div>
          <div className="metric-sub" style={{ color:"var(--red)" }}>items at risk today</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Supplier Score</div>
          <div className="metric-value">{stats.avg_supplier_score}</div>
          <div className="metric-sub" style={{ color:"var(--green)" }}>avg reliability</div>
        </div>
      </div>

      {/* ── CHARTS ──────────────────────────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="chart-card">
          <div className="chart-title">Daily demand & stock trend</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background:"#7c6af7" }} />Demand</div>
            <div className="legend-item"><span className="legend-dot" style={{ background:"#2dd4a0" }} />Stock</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" tick={{ fill:"#8888aa", fontSize:10 }} />
              <YAxis tick={{ fill:"#8888aa", fontSize:10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="demand" stroke="#7c6af7" strokeWidth={2} dot={{ fill:"#7c6af7", r:3 }} name="Demand" />
              <Line type="monotone" dataKey="stock"  stroke="#2dd4a0" strokeWidth={2} strokeDasharray="5 5" dot={{ fill:"#2dd4a0", r:3 }} name="Stock" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stockout risk by weather</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background:"#f06292" }} />High risk</div>
            <div className="legend-item"><span className="legend-dot" style={{ background:"#2dd4a0" }} />Low risk</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="weather" tick={{ fill:"#8888aa", fontSize:10 }} />
              <YAxis tick={{ fill:"#8888aa", fontSize:10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="high" stackId="a" fill="#f06292" name="High risk" />
              <Bar dataKey="low"  stackId="a" fill="#2dd4a0" name="Low risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── AI STOCK FORECASTER ─────────────────────────────────────────────── */}
      <div style={{
        background:"rgba(240,98,146,0.05)", border:"1px solid rgba(240,98,146,0.2)",
        borderRadius:"var(--radius-lg)", padding:20, marginBottom:24,
      }}>
        {/* Header forecaster */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ color:"#f06292", fontSize:16, fontWeight:700, margin:0, display:"flex", alignItems:"center", gap:8 }}>
            🧠 AI Stock Forecaster
          </h3>
          {/* Tombol Re-train */}
          <button
            onClick={handleRetrain} disabled={retraining}
            style={{
              background: retraining ? "#94a3b8" : "#7c3aed",
              color:"white", border:"none", padding:"7px 16px",
              borderRadius:8, cursor: retraining ? "wait" : "pointer",
              fontWeight:700, fontSize:12,
              boxShadow:"0 4px 10px rgba(124,58,237,0.25)",
              transition:"background 0.2s",
            }}
          >
            {retraining ? "⏳ Training..." : "🔁 Re-train AI"}
          </button>
        </div>

        {/* Hasil retrain */}
        {retrainResult && (
          <div style={{
            padding:"10px 14px", borderRadius:8, marginBottom:14,
            background: retrainResult.type === "success" ? "rgba(124,58,237,0.08)" : "rgba(255,82,82,0.08)",
            border: `1px solid ${retrainResult.type === "success" ? "rgba(124,58,237,0.3)" : "rgba(255,82,82,0.3)"}`,
          }}>
            {retrainResult.type === "success" ? (
              <div>
                <p style={{ fontWeight:700, color:"#7c3aed", marginBottom:4, fontSize:13 }}>
                  ✅ {retrainResult.data.message}
                </p>
                <p style={{ fontSize:12, color:"#64748b", margin:0 }}>
                  Akurasi baru: <strong style={{ color:"#7c3aed" }}>{retrainResult.data.accuracy}</strong>
                  &nbsp;·&nbsp; Training: {retrainResult.data.training_data} data
                  &nbsp;·&nbsp; Test: {retrainResult.data.test_data} data
                </p>
              </div>
            ) : (
              <p style={{ color:"#dc2626", fontSize:13, margin:0 }}>❌ {retrainResult.msg}</p>
            )}
          </div>
        )}

        {/* Input predict */}
        <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
          <input
            type="text" value={checkId}
            onChange={(e) => setCheckId(e.target.value.toUpperCase())}
            placeholder="Enter Product ID"
            style={{ background:"white", border:"2px solid var(--border)", color:"var(--text)", padding:"10px 14px", borderRadius:"var(--radius)", fontSize:14, flex:1, minWidth:160 }}
          />
          <button
            onClick={handleCheckAI} disabled={loadingAi}
            style={{ background:"#f06292", color:"white", border:"none", padding:"8px 20px", cursor: loadingAi ? "wait" : "pointer", fontWeight:700, borderRadius:8 }}
          >
            {loadingAi ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>

        {/* Hasil predict */}
        {aiResult && (
          <div style={{
            background: aiResult.ai_prediction === "Yes" ? "rgba(255,82,82,0.08)" : "rgba(45,212,160,0.08)",
            padding:14, borderRadius:8,
            borderLeft: `4px solid ${aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0"}`,
          }}>
            <p style={{ fontWeight:600, fontSize:14, color:"#1f2937", marginBottom:4 }}>
              Prediction for <span style={{ color:"var(--accent2)" }}>{aiResult.product_id}</span>:{" "}
              <span style={{ color: aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0" }}>
                {aiResult.ai_prediction === "Yes" ? "⚠️ High Risk" : "✅ Safe"}
              </span>
            </p>
            <p style={{ fontSize:12, color:"#8888aa", margin:0 }}>
              Risk Probability: <strong>{aiResult.risk_probability_percent}%</strong> — {aiResult.ai_insight}
            </p>
          </div>
        )}
      </div>

      {/* ── HIGH / LOW RISK TABLE ───────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:"flex", width:"100%", marginBottom:20, borderBottom:"1px solid #e2e8f0" }}>
          {[
            { key:"high", label:"High Risk",   color:"var(--red)"   },
            { key:"low",  label:"Safe Stocks",  color:"var(--green)" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flex:1, padding:"14px 30px", cursor:"pointer", fontWeight:700, fontSize:14,
                border:"none", outline:"none",
                backgroundColor: isActive ? "#f8fafc" : "transparent",
                color: isActive ? tab.color : "#8888aa",
                borderBottom: isActive ? `3px solid ${tab.color}` : "3px solid transparent",
                borderRadius:"8px 8px 0 0", marginBottom:"-1px", transition:"all 0.2s",
              }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign:"center" }}>PRODUCT ID</th>
                <th style={{ textAlign:"center" }}>STORE</th>
                <th style={{ textAlign:"center" }}>STOCK</th>
                <th style={{ textAlign:"center" }}>DEMAND</th>
                <th style={{ textAlign:"center" }}>RISK</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === "high" ? highRiskProducts : lowRiskProducts).map((p) => (
                <tr key={p.product_id}>
                  <td style={{ textAlign:"center", fontFamily:"var(--mono)", color:"var(--accent2)" }}>{p.product_id}</td>
                  <td style={{ textAlign:"center", fontFamily:"var(--mono)" }}>{p.store_id}</td>
                  <td style={{ textAlign:"center", fontFamily:"var(--mono)", color: activeTab==="high" ? "var(--red)" : "var(--green)" }}>
                    {p.current_stock}
                  </td>
                  <td style={{ textAlign:"center", fontFamily:"var(--mono)" }}>{p.daily_demand}</td>
                    <td style={{ textAlign:"center" }}>
                    {activeTab === "high" ? (
                      <span className="badge badge-yes">High</span>
                    ) : (
                      <span className="badge badge-no">Safe</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}