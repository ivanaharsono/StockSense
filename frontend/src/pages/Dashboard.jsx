import React, { useState, useEffect } from 'react';
import api, { getAiPrediction } from '../api';
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
      fontFamily: "DM Mono, monospace",
    }}>
      <p style={{ color: "#8888aa", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats]           = useState(null);
  const [trendData, setTrendData]   = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [loading, setLoading]       = useState(true);
  // BUG FIX: error state ditambahkan — sebelumnya error fetch dibiarkan silent
  const [error, setError]           = useState(null);
  const [activeTab, setActiveTab]   = useState('high');

  const [aiResult, setAiResult]     = useState(null);
  const [loadingAi, setLoadingAi]   = useState(false);
  const [checkId, setCheckId]       = useState('P1001');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsRes, trendRes, weatherRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/trend"),
          api.get("/analytics/weather"),
        ]);

        setStats(statsRes.data);
        setTrendData(trendRes.data);

        // BUG FIX: field mapping diperjelas — pastikan key dari backend konsisten
        // Backend diharapkan return: [{ weather, stockout, safe }, ...]
        const formattedWeather = weatherRes.data.map((w) => ({
          weather: w.weather,
          high: w.high,  
          low: w.low,      
        }));
        setWeatherData(formattedWeather);
      } catch (err) {
        console.error("Gagal sinkronisasi data dengan Backend:", err);
        // BUG FIX: error disimpan ke state, bukan cuma di-console.error
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleCheckAI = async () => {
    // BUG FIX: validasi input kosong sebelum hit API
    if (!checkId.trim()) {
      alert("Masukkan Product ID dulu.");
      return;
    }
    setLoadingAi(true);
    setAiResult(null);
    try {
      const result = await getAiPrediction(checkId);
      setAiResult(result);
    } catch (err) {
      console.error("AI prediction error:", err);
      alert("AI gagal ambil data. Cek apakah ID sudah benar?");
    } finally {
      setLoadingAi(false);
    }
  };

  // BUG FIX: handle error state — sebelumnya layar stuck di loading kalau fetch gagal
  if (error) {
    return (
      <div className="page fade-up" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p style={{ color: 'var(--red)' }}>Gagal memuat data: {error}</p>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="page fade-up" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--accent2)' }}>
        <p>Menyinkronkan data dengan PostgreSQL...</p>
      </div>
    );
  }

  // BUG FIX: fallback array kosong kalau key tidak ada di response backend
  const highRiskProducts = stats.high_risk_products ?? [];
  const lowRiskProducts  = stats.low_risk_products  ?? [];

  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Inventory Overview</h1>
          <p>Real-time data with {stats.total_products?.toLocaleString() ?? "—"} records synced</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Total Products</div>
          <div className="metric-value">{stats.total_products?.toLocaleString()}</div>
          <div className="metric-sub" style={{ color: "var(--green)" }}>in active catalog</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Daily Demand</div>
          <div className="metric-value">{stats.avg_daily_demand?.toLocaleString()}</div>
          <div className="metric-sub" style={{ color: "var(--amber)" }}>across all stores</div>
        </div>
        <div className="metric-card" style={{ borderColor: "rgba(240,98,146,0.3)" }}>
          <div className="metric-label">Stockout Risk</div>
          <div className="metric-value" style={{ color: "var(--red)" }}>{stats.stockout_risk_count}</div>
          <div className="metric-sub" style={{ color: "var(--red)" }}>items at risk today</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Supplier Score</div>
          <div className="metric-value">{stats.avg_supplier_score}</div>
          <div className="metric-sub" style={{ color: "var(--green)" }}>avg reliability</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="chart-card">
          <div className="chart-title">Daily demand & stock trend</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#7c6af7" }} />Demand</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#2dd4a0" }} />Stock</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date"   tick={{ fill: "#8888aa", fontSize: 10 }} />
              <YAxis                  tick={{ fill: "#8888aa", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="demand" stroke="#7c6af7" strokeWidth={2} dot={{ fill: "#7c6af7", r: 3 }} name="Demand" />
              <Line type="monotone" dataKey="stock"  stroke="#2dd4a0" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#2dd4a0", r: 3 }} name="Stock" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stockout risk by weather</div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f06292" }} />High risk</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#2dd4a0" }} />Low risk</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="weather" tick={{ fill: "#8888aa", fontSize: 10 }} />
              <YAxis                   tick={{ fill: "#8888aa", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="high" stackId="a" fill="#f06292" name="High risk" />
              <Bar dataKey="low"  stackId="a" fill="#2dd4a0" name="Low risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Stock Forecaster */}
      <div style={{
        background: "rgba(240, 98, 146, 0.05)",
        border: "1px solid rgba(240, 98, 146, 0.2)",
        borderRadius: "var(--radius-lg)",
        padding: 20, marginBottom: 24,
      }}>
        <h3 style={{ color: "#f06292", fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🧠</span> AI Stock Forecaster (97.8% Accuracy)
        </h3>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            value={checkId}
            onChange={(e) => setCheckId(e.target.value.toUpperCase())}
            style={{
              background: "white",
              border: "2px solid var(--border)",
              color: "var(--text)",
              padding: "10px 14px",
              borderRadius: "var(--radius)",
              fontSize: 14,
            }}
            placeholder="P1001"
          />
          <button
            onClick={handleCheckAI}
            className="btn btn-primary"
            style={{ 
              background: "#f06292", 
              color: "white",       
              border: "none", 
              padding: "8px 20px",
              cursor: "pointer",
              fontWeight: "700",    
              borderRadius: "8px"
            }}
            disabled={loadingAi}
          >
            {loadingAi ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>

        {aiResult && (
          <div style={{
            background: aiResult.ai_prediction === "Yes" ? "rgba(255,82,82,0.1)" : "rgba(45,212,160,0.1)",
            padding: 15, borderRadius: 8,
            borderLeft: `4px solid ${aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0"}`,
          }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: "#1f2937", marginBottom: 4 }}>
              Prediction for {aiResult.product_id}:{" "}
              <span style={{ color: aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0" }}>
                {aiResult.ai_prediction}
              </span>
            </p>
            <p style={{ fontSize: 12, color: "#8888aa" }}>
              Risk Probability: {aiResult.risk_probability_percent}% — {aiResult.ai_insight}
            </p>
          </div>
        )}
      </div>

      {/* High / Low Risk Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ 
          display: "flex", 
          width: "100%", // BIAR AREANYA LUAS SAMPAI UJUNG
          marginBottom: 20, 
          borderBottom: "1px solid #e2e8f0" 
        }}>
          {[
            { key: "high", label: "High Risk",   color: "var(--red)"   },
            { key: "low",  label: "Safe Stocks",  color: "var(--green)" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, // KUNCINYA DI SINI: BIAR BAGI RATA SAMPE UJUNG
                  padding: "14px 30px", // Ditambah dikit biar areanya mantap diklik
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  
                  // HILANGIN STROKE: Gak ada border pinggir
                  border: "none",
                  outline: "none",

                  // GELAPIN AREANYA: Pake abu-abu soft (#f8fafc) pas aktif biar kontras
                  backgroundColor: isActive ? "#f8fafc" : "transparent", 
                  
                  color: isActive ? tab.color : "#8888aa",
                  
                  // Penanda garis bawah tetep ada biar cakep
                  borderBottom: isActive ? `3px solid ${tab.color}` : "3px solid transparent",
                  
                  // Layouting & Transition
                  borderRadius: "8px 8px 0 0", 
                  marginBottom: "-1px", 
                  transition: "all 0.2s ease-in-out",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "center" }}>PRODUCT ID</th>
                <th style={{ textAlign: "center" }}>STORE</th>
                <th style={{ textAlign: "center" }}>STOCK</th>
                <th style={{ textAlign: "center" }}>DEMAND</th>
                <th style={{ textAlign: "center" }}>RISK</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === "high" ? highRiskProducts : lowRiskProducts).map((p) => (
                <tr key={p.product_id}>
                  <td style={{ textAlign: "center", fontFamily: "var(--mono)", color: "var(--accent2)" }}>
                    {p.product_id}
                  </td>
                  <td style={{ textAlign: "center", fontFamily: "var(--mono)" }}>
                    {p.store_id}
                  </td>
                  <td style={{ 
                    textAlign: "center", 
                    color: activeTab === "high" ? "var(--red)" : "var(--green)", 
                    fontFamily: "var(--mono)" 
                  }}>
                    {p.current_stock}
                  </td>
                  <td style={{ textAlign: "center", fontFamily: "var(--mono)" }}>
                    {p.daily_demand}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className={`badge badge-${p.stockout_risk.toLowerCase()}`}>
                      {p.stockout_risk}
                    </span>
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