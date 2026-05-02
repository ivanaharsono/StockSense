import React, { useState, useEffect } from 'react';
// Jalur relatif: naik satu folder (..) lalu cari api
import api, { getAiPrediction } from '../api'; 
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a28", border: "1px solid #252538", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: "DM Mono, monospace" }}>
      <p style={{ color: "#8888aa", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('high');

  // ─── STATE KHUSUS AI ───
  const [aiResult, setAiResult] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [checkId, setCheckId] = useState('P1001');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsRes, trendRes, weatherRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/trend"),
          api.get("/analytics/weather")
        ]);

        setStats(statsRes.data);
        setTrendData(trendRes.data);
        const formattedWeather = weatherRes.data.map(w => ({
          weather: w.weather,
          high: w.stockout,
          low: w.safe
        }));
        setWeatherData(formattedWeather);
      } catch (error) {
        console.error("Gagal sinkronisasi data dengan Backend:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleCheckAI = async () => {
    setLoadingAi(true);
    setAiResult(null);
    try {
      const result = await getAiPrediction(checkId);
      setAiResult(result);
    } catch (error) {
      alert("Gagal ambil data AI. Cek apakah ID sudah benar?");
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="page fade-up" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--accent2)' }}>
        <p>Menyinkronkan data dengan PostgreSQL...</p>
      </div>
    );
  }

  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Inventory Overview</h1>
          <p>Real-time data with 2800 records synced</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Total Products</div>
          <div className="metric-value">{stats.total_products.toLocaleString()}</div>
          <div className="metric-sub" style={{ color: "var(--green)" }}>in active catalog</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Daily Demand</div>
          <div className="metric-value">{stats.avg_daily_demand.toLocaleString()}</div>
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
              <XAxis dataKey="date" tick={{ fill: "#8888aa", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8888aa", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="demand" stroke="#7c6af7" strokeWidth={2} dot={{ fill: "#7c6af7", r: 3 }} name="Demand" />
              <Line type="monotone" dataKey="stock" stroke="#2dd4a0" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#2dd4a0", r: 3 }} name="Stock" />
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
              <YAxis tick={{ fill: "#8888aa", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="high" stackId="a" fill="#f06292" name="High risk" />
              <Bar dataKey="low" stackId="a" fill="#2dd4a0" name="Low risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── NEW: AI STOCK FORECASTER PANEL ─── */}
      <div style={{ background: "rgba(240, 98, 146, 0.05)", border: "1px solid rgba(240, 98, 146, 0.2)", borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: "#f06292", fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🧠</span> AI Stock Forecaster (97.8% Accuracy)
        </h3>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <input 
            type="text" 
            value={checkId} 
            onChange={(e) => setCheckId(e.target.value.toUpperCase())}
            // Hapus background item & color white-nya, ganti jadi transparan/bersih
            style={{ 
              background: "white", 
              border: "1px solid var(--border)", 
              color: "var(--text)", 
              padding: "10px 14px", 
              borderRadius: "var(--radius)", // Pakai variabel 8px dari CSS tadi
              fontSize: 14 
            }}
            placeholder="P1001"
          />
          <button 
            onClick={handleCheckAI} 
            className="btn btn-primary" 
            style={{ background: "#f06292", border: "none", padding: "8px 20px" }}
            disabled={loadingAi}
          >
            {loadingAi ? "Analyzing..." : "Analyze with AI ✨"}
          </button>
        </div>

        {aiResult && (
          <div style={{ background: aiResult.ai_prediction === "Yes" ? "rgba(255, 82, 82, 0.1)" : "rgba(45, 212, 160, 0.1)", padding: 15, borderRadius: 8, borderLeft: `4px solid ${aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0"}` }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: "white", marginBottom: 4 }}>
              Prediction for {aiResult.product_id}: <span style={{ color: aiResult.ai_prediction === "Yes" ? "#ff5252" : "#2dd4a0" }}>{aiResult.ai_prediction}</span>
            </p>
            <p style={{ fontSize: 12, color: "#8888aa" }}>Risk Probability: {aiResult.risk_probability_percent}% — {aiResult.ai_insight}</p>
          </div>
        )}
      </div>

      {/* High Risk Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, marginBottom: 16, borderBottom: "1px solid #252538" }}>
          <button 
            onClick={() => setActiveTab('high')}
            style={{ 
              paddingBottom: 10, 
              background: "none", 
              border: "none", 
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: activeTab === 'high' ? "var(--red)" : "#8888aa", 
              borderBottom: activeTab === 'high' ? "2px solid var(--red)" : "none" 
            }}
          >
            🔥 High Risk
          </button>
          <button 
            onClick={() => setActiveTab('low')}
            style={{ 
              paddingBottom: 10, 
              background: "none", 
              border: "none", 
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: activeTab === 'low' ? "var(--green)" : "#8888aa", 
              borderBottom: activeTab === 'low' ? "2px solid var(--green)" : "none" 
            }}
          >
            ✅ Safe Stocks
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PRODUCT ID</th><th>STORE</th><th>STOCK</th><th>DEMAND</th><th>RISK</th>
              </tr>
            </thead>
            <tbody>
              {/* Logika filter: tampilkan data sesuai tab yang diklik */}
              {(activeTab === 'high' ? stats.high_risk_products : stats.low_risk_products).map(p => (
                <tr key={p.product_id}>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--accent2)", fontSize: 12 }}>{p.product_id}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.store_id}</td>
                  <td style={{ color: activeTab === 'high' ? "var(--red)" : "var(--green)", fontFamily: "var(--mono)" }}>
                    {p.current_stock}
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>{p.daily_demand}</td>
                  <td>
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