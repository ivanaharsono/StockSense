import { useState, useEffect } from "react";
import { BASE, getWorkspaceId } from "../api";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── HELPERS ───────────────────────────────────────────────────
const supplierColor = (score) =>
  score >= 80 ? "#10b981" : score >= 65 ? "#f59e0b" : "#ef4444";

const wsFetch = (path) =>
  fetch(`${BASE}${path}`, { headers: { "X-Workspace-Id": getWorkspaceId() } }).then((r) => r.json());

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid rgba(240, 98, 146, 0.3)",
      borderRadius: 8, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 12px rgba(240, 98, 146, 0.1)",
    }}>
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

  const [stores, setStores]           = useState([]);
  const [storeData, setStoreData]     = useState({});
  const [weatherData, setWeatherData] = useState([]);
  const [suppliers, setSuppliers]     = useState([]);   // { name, score, leadTime }
  const [trendData, setTrendData]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    Promise.all([
      wsFetch("/analytics/stores"),
      wsFetch("/analytics/weather"),
      wsFetch("/analytics/suppliers"),
      wsFetch("/dashboard/trend"),
    ])
      .then(([storesData, weatherRes, suppliersRes, trendRes]) => {
        const storeObj = {};
        storesData.forEach(s => {
          storeObj[s.store_id] = {
            promoD: s.promoD, noPromoD: s.noPromoD,
            avgDemand: s.avg_demand, avgStock: s.avg_stock,
            stockoutRate: s.stockout_rate,
          };
        });

        setStores(storesData.map(s => s.store_id));
        setStoreData(storeObj);
        setWeatherData(weatherRes);
        setSuppliers(suppliersRes.map(sup => ({
          name: sup.store_id,
          score: Math.round(sup.avg_reliability_score),
          leadTime: sup.avg_lead_time_days,
        })));
        setTrendData(trendRes);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gagal fetch analytics data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="page fade-up" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'80vh' }}>
      <p style={{ color:'var(--text2)' }}>Loading analytics...</p>
    </div>
  );
  if (error) return (
    <div className="page fade-up" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'80vh' }}>
      <p style={{ color:'var(--red)' }}>Error: {error}</p>
    </div>
  );

  // ── DERIVED DATA (semua dihitung dari data real) ─────────────
  const filteredStores = storeFilter === "all" ? stores : [storeFilter];
  const sortedStores = [...filteredStores].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }));

  const promoChartData = sortedStores.map((s) => ({
    store: `Store ${s}`,
    promo:   storeData[s]?.promoD   ?? 0,
    noPromo: storeData[s]?.noPromoD ?? 0,
  }));

  const storeTableData = filteredStores.map((s) => ({ store: s, ...storeData[s] }));
  const n = filteredStores.length || 1;

  const avgDemand = Math.round(
    filteredStores.reduce((a, s) => a + (storeData[s]?.avgDemand ?? 0), 0) / n
  );
  const avgStockout = (
    filteredStores.reduce((a, s) => a + (storeData[s]?.stockoutRate ?? 0), 0) / n
  ).toFixed(1);

  const totalPromo   = filteredStores.reduce((a, s) => a + (storeData[s]?.promoD   ?? 0), 0);
  const totalNoPromo = filteredStores.reduce((a, s) => a + (storeData[s]?.noPromoD ?? 0), 0);
  const promoUplift  = totalNoPromo > 0
    ? Math.round(((totalPromo - totalNoPromo) / totalNoPromo) * 100)
    : 0;

  const relevantSuppliers = suppliers.filter(s => filteredStores.includes(s.name));
  const avgLeadTime = relevantSuppliers.length
    ? (relevantSuppliers.reduce((a, s) => a + (s.leadTime ?? 0), 0) / relevantSuppliers.length).toFixed(1)
    : "0.0";

  // lebar minimum promo chart biar batang gak gepeng (scroll horizontal kalau store banyak)
  const promoMinWidth = Math.max(promoChartData.length * 70, 400);

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1>Analytics</h1>
          <p>Insight mendalam dari data inventory</p>
        </div>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="filter-select">
          <option value="all">Semua store</option>
          {[...stores].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map((s) => (
            <option key={s} value={s}>Store {s}</option>
          ))}
        </select>
      </div>

      {/* KPIs — semua angka real */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Avg Demand</div>
          <div className="metric-value">{avgDemand.toLocaleString()}</div>
          <div className="metric-sub" style={{ color: "var(--text2)" }}>unit / hari</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promo uplift</div>
          <div className="metric-value" style={{ color: "#7c6af7" }}>
            {promoUplift >= 0 ? "+" : ""}{promoUplift}%
          </div>
          <div className="metric-sub" style={{ color: "var(--text2)" }}>demand promo vs non-promo</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg lead time</div>
          <div className="metric-value" style={{ color: "#f59e0b" }}>{avgLeadTime}d</div>
          <div className="metric-sub" style={{ color: "var(--text2)" }}>rata-rata semua supplier</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Stockout rate</div>
          <div className="metric-value" style={{ color: "#ef4444" }}>{avgStockout}%</div>
          <div className="metric-sub" style={{ color: "var(--text2)" }}>produk berisiko habis</div>
        </div>
      </div>

      {/* Promo chart — FULL WIDTH, scroll horizontal di dalam */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">Demand: Promo vs No Promo</div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          Membandingkan lonjakan permintaan saat ada promo (batang penuh) vs hari biasa (batang transparan).
        </p>
        <div className="chart-legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: "#7c6af7" }} />Promo aktif</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: "#e2e8f0", border: "1px solid #7c6af7" }} />No promo</div>
        </div>
        <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 4 }}>
          <div style={{ minWidth: promoMinWidth, height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={promoChartData} barGap={4} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="store" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="promo"   name="Promo aktif" fill="#7c6af7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="noPromo" name="No promo"    fill="#f1f5f9" stroke="#7c6af7" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row: Weather | Stok vs Demand */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Stockout Risk vs Weather Impact</div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Melihat ketahanan stok barang saat cuaca buruk (High) dibanding cuaca cerah (Low).
          </p>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#f06292" }} />High risk</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} />Low risk</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weatherData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="weather" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="high" name="High risk" stackId="a" fill="#f06292" />
              <Bar dataKey="low"  name="Low risk"  stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stok vs Demand Harian</div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Garis Ungu (Stok) vs Garis Hijau (Demand). Aman jika garis ungu selalu di atas garis hijau.
          </p>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "#7c6af7" }} />Stok</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} />Demand</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="stock"  name="Stok"   stroke="#7c6af7" strokeWidth={3} dot={{ r: 3, fill: "#7c6af7" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="demand" name="Demand" stroke="#10b981" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 3, fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Supplier reliability — FULL WIDTH, scroll vertikal, urut terburuk dulu */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">Supplier Reliability Score</div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          Diurut dari skor terendah. Skor tinggi = supplier jarang telat & kirimannya selalu baik.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, maxHeight: 260, overflowY: "auto", paddingRight: 8 }}>
          {[...relevantSuppliers].sort((a, b) => a.score - b.score).map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#64748b", width: 80, fontWeight: 500, flexShrink: 0 }}>Store {s.name}</span>
              <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: supplierColor(s.score), borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: 12, color: supplierColor(s.score), width: 30, fontWeight: 700, flexShrink: 0 }}>{s.score}</span>
            </div>
          ))}
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
                <th>STORE</th><th>STOCKOUT RATE</th><th>AVG DEMAND</th><th>AVG STOK</th><th>STATUS</th>
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
                      <span style={{ padding: "4px 12px", borderRadius: 20, background: rateBg, color: rateColor, fontSize: 11, fontWeight: 700 }}>
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