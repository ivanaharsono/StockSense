import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── HELPERS ───────────────────────────────────────────────────

const supplierColor = (score) =>
  score >= 80 ? "#10b981" : score >= 65 ? "#f59e0b" : "#ef4444";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(240, 98, 146, 0.3)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(240, 98, 146, 0.1)",
      }}
    >
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color === "#f1f5f9" ? "#475569" : p.color, margin: "2px 0", fontWeight: 600 }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────

export default function Analytics() {
  const [storeFilter, setStoreFilter] = useState("all");

  // Masing-masing state untuk setiap endpoint
  const [stores, setStores]           = useState([]);
  const [storeData, setStoreData]     = useState({});
  const [weatherData, setWeatherData] = useState([]);
  const [suppliers, setSuppliers]     = useState([]);
  const [trendData, setTrendData]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    // Sesuaikan URL base dengan FastAPI lu
    const BASE = "http://localhost:8000";

    Promise.all([
      fetch(`${BASE}/analytics/stores`).then((r) => r.json()),
      fetch(`${BASE}/analytics/weather`).then((r) => r.json()),
      fetch(`${BASE}/analytics/suppliers`).then((r) => r.json()),
      fetch(`${BASE}/dashboard/trend`).then((r) => r.json()),
    ])
      .then(([storesData, weatherRes, suppliersRes, trendRes]) => {
        // 1. Ekstrak daftar Store ID ("S1", "S2", dst)
        const storeIds = storesData.map(s => s.store_id);

        // 2. Ubah array dari backend jadi Object yang diminta React
        const storeObj = {};
        storesData.forEach(s => {
          storeObj[s.store_id] = {
            promoD: s.promoD,
            noPromoD: s.noPromoD,
            avgDemand: s.avg_demand,
            avgStock: s.avg_stock,
            stockoutRate: s.stockout_rate
          };
        });

        // 3. Format data supplier untuk progress bar
        const formattedSuppliers = suppliersRes.map(sup => ({
          name: sup.store_id, 
          score: Math.round(sup.avg_reliability_score)
        }));

        setStores(storeIds);
        setStoreData(storeObj);
        setWeatherData(weatherRes);
        setSuppliers(formattedSuppliers);
        setTrendData(trendRes);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gagal fetch analytics data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Memuat analytics...</p>;
  if (error)   return <p style={{ padding: 24, color: "#ef4444" }}>Error: {error}</p>;

  // ── DERIVED DATA ─────────────────────────────────────────────

  const filteredStores = storeFilter === "all" ? stores : [storeFilter];

  const promoChartData = filteredStores
    .sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true}))
    .map((s) => ({
      store: `Store ${s}`,
      promo:   storeData[s]?.promoD   ?? 0,
      noPromo: storeData[s]?.noPromoD ?? 0,
    }));

  const storeTableData = filteredStores.map((s) => ({ store: s, ...storeData[s] }));

  const avgDemand = Math.round(
    filteredStores.reduce((a, s) => a + (storeData[s]?.avgDemand ?? 0), 0) / filteredStores.length
  );
  const avgStockout = (
    filteredStores.reduce((a, s) => a + (storeData[s]?.stockoutRate ?? 0), 0) / filteredStores.length
  ).toFixed(1);

  // ── RENDER ────────────────────────────────────────────────────

  return (
    <div className="page fade-up">
      {/* Header */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}
      >
        <div>
          <h1>Analytics</h1>
          <p>Insight mendalam dari data inventory</p>
        </div>
        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">Semua store</option>
          {[...stores].sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true})).map((s) => (
            <option key={s} value={s}>Store {s}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Avg Demand</div>
          <div className="metric-value">{avgDemand.toLocaleString()}</div>
          <div className="metric-sub" style={{ color: "#10b981" }}>+8.2% vs periode lalu</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promo uplift</div>
          <div className="metric-value" style={{ color: "#7c6af7" }}>+34%</div>
          <div className="metric-sub">demand saat promo aktif</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg lead time</div>
          <div className="metric-value" style={{ color: "#f59e0b" }}>4.2d</div>
          <div className="metric-sub">across all suppliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Stockout rate</div>
          <div className="metric-value" style={{ color: "#ef4444" }}>{avgStockout}%</div>
          <div className="metric-sub" style={{ color: "#ef4444" }}>-2.1% vs periode lalu</div>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Demand: Promo vs No Promo</div>
          <div className="chart-header">
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Membandingkan lonjakan permintaan saat ada promo (batang penuh) vs hari biasa (batang transparan).
          </p>
        </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#7c6af7" }} />Promo aktif
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#e2e8f0", border: "1px solid #7c6af7" }} />No promo
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={promoChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="store" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="promo"   name="Promo aktif" fill="#7c6af7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="noPromo" name="No promo"    fill="#f1f5f9" stroke="#7c6af7" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stockout Risk vs Weather Impact</div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Melihat ketahanan stok barang saat cuaca buruk (High) dibanding cuaca cerah (Low).
          </p>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f06292" }} />High risk</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }} />Medium</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} />Low risk</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="weather" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="high"   name="High risk" stackId="a" fill="#f06292" />
              <Bar dataKey="medium" name="Medium"    stackId="a" fill="#f59e0b" />
              <Bar dataKey="low"    name="Low risk"  stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Supplier Reliability Score</div>
          <div className="chart-header">
  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
    Peringkat performa supplier. Skor tinggi berarti supplier jarang telat dan kirimannya selalu baik.
  </p>
</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {suppliers.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#64748b", width: 80, fontWeight: 500 }}>{s.name}</span>
                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${s.score}%`,
                      background: supplierColor(s.score),
                      borderRadius: 4,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: supplierColor(s.score), width: 30, fontWeight: 700 }}>
                  {s.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stok vs Demand Harian</div>
          <div className="chart-header">
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Garis Ungu (Stok) vs Garis Hijau (Demand). Aman jika garis ungu selalu di atas garis hijau.
            </p>
          </div>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#7c6af7" }} />Stok</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} />Demand</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="stock"  name="Stok"   stroke="#7c6af7" strokeWidth={3} dot={{ r: 4, fill: "#7c6af7" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="demand" name="Demand" stroke="#10b981" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Store Table */}
      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>Performa per store</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>Analisis distribusi stok dan risiko per cabang</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>STORE</th>
                <th>STOCKOUT RATE</th>
                <th>AVG DEMAND</th>
                <th>AVG STOK</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {storeTableData.map((d) => {
                const rateColor = d.stockoutRate > 25 ? "#ef4444" : d.stockoutRate > 15 ? "#f59e0b" : "#10b981";
                const rateBg    = d.stockoutRate > 25 ? "#fef2f2" : d.stockoutRate > 15 ? "#fffbeb" : "#ecfdf5";
                const status    = d.stockoutRate > 25 ? "Kritis"  : d.stockoutRate > 15 ? "Pantau"  : "Aman";
                return (
                  <tr key={d.store}>
                    <td style={{ fontWeight: 700, color: "#7c6af7" }}>Store {d.store}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, maxWidth: 100 }}>
                          <div style={{ height: "100%", width: `${d.stockoutRate}%`, background: rateColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 600, color: rateColor }}>{d.stockoutRate}%</span>
                      </div>
                    </td>
                    <td>{d.avgDemand} unit</td>
                    <td>{d.avgStock} unit</td>
                    <td>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 20,
                          background: rateBg,
                          color: rateColor,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}