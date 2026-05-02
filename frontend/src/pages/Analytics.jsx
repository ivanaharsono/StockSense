import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Data Constants (Tetap sama)
const STORES = ["S-01","S-02","S-03","S-04","S-05","S-07","S-08","S-09","S-10","S-11","S-12"];
const STORE_DATA = {
  "S-01": { promoD:118, noPromoD:82, stockoutRate:22, avgDemand:95, avgStock:155 },
  "S-02": { promoD:95,  noPromoD:72, stockoutRate:12, avgDemand:80, avgStock:280 },
  "S-03": { promoD:102, noPromoD:68, stockoutRate:25, avgDemand:88, avgStock:120 },
  "S-04": { promoD:88,  noPromoD:61, stockoutRate:28, avgDemand:78, avgStock:95  },
  "S-05": { promoD:78,  noPromoD:58, stockoutRate:8,  avgDemand:65, avgStock:310 },
  "S-07": { promoD:130, noPromoD:88, stockoutRate:35, avgDemand:110,avgStock:85  },
  "S-08": { promoD:105, noPromoD:74, stockoutRate:18, avgDemand:92, avgStock:190 },
  "S-09": { promoD:112, noPromoD:80, stockoutRate:14, avgDemand:88, avgStock:210 },
  "S-10": { promoD:72,  noPromoD:55, stockoutRate:6,  avgDemand:60, avgStock:340 },
  "S-11": { promoD:125, noPromoD:85, stockoutRate:30, avgDemand:105,avgStock:100 },
  "S-12": { promoD:80,  noPromoD:62, stockoutRate:9,  avgDemand:68, avgStock:290 },
};
const WEATHER_DATA = [
  { weather:"Low",    high:12, medium:18, low:70 },
  { weather:"Medium", high:38, medium:28, low:34 },
  { weather:"High",   high:72, medium:20, low:8  },
];
const SUPPLIERS = [
  { name:"SUP-015", score:97 }, { name:"SUP-009", score:93 },
  { name:"SUP-004", score:91 }, { name:"SUP-011", score:88 },
  { name:"SUP-002", score:86 }, { name:"SUP-008", score:84 },
  { name:"SUP-006", score:76 }, { name:"SUP-012", score:67 },
  { name:"SUP-007", score:55 }, { name:"SUP-003", score:58 },
].sort((a,b) => a.score - b.score);
const TREND_DATA = [
  { date:"1 Apr",  stock:38000, demand:8200  },
  { date:"5 Apr",  stock:36500, demand:8800  },
  { date:"10 Apr", stock:34800, demand:9400  },
  { date:"15 Apr", stock:33200, demand:10200 },
  { date:"20 Apr", stock:32100, demand:10800 },
  { date:"25 Apr", stock:30500, demand:11500 },
  { date:"30 Apr", stock:29000, demand:12000 },
];

// --- TOOLTIP MODERN (LIGHT MODE) ---
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

function supplierColor(score) {
  return score >= 80 ? "#10b981" : score >= 65 ? "#f59e0b" : "#ef4444";
}

export default function Analytics() {
  const [storeFilter, setStoreFilter] = useState("all");

  const filteredStores = storeFilter === "all" ? STORES : [storeFilter];
  const promoChartData = filteredStores.map(s => ({
    store: s,
    promo: STORE_DATA[s].promoD,
    noPromo: STORE_DATA[s].noPromoD,
  }));

  const storeTableData = filteredStores.map(s => ({ store: s, ...STORE_DATA[s] }));
  const avgDemand = Math.round(filteredStores.reduce((a, s) => a + STORE_DATA[s].avgDemand, 0) / filteredStores.length);
  const avgStockout = (filteredStores.reduce((a, s) => a + STORE_DATA[s].stockoutRate, 0) / filteredStores.length).toFixed(1);

  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 32 }}>
        <div>
          <h1>Analytics</h1>
          <p>Insight mendalam dari data inventory</p>
        </div>
        <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="filter-select">
          <option value="all">Semua store</option>
          {STORES.map(s => <option key={s} value={s}>Store {s}</option>)}
        </select>
      </div>

      {/* KPIs (GRID 4) */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Avg Demand</div>
          <div className="metric-value">{avgDemand.toLocaleString()}</div>
          <div className="metric-sub" style={{ color:"var(--green)" }}>+8.2% vs periode lalu</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promo uplift</div>
          <div className="metric-value" style={{ color:"var(--accent)" }}>+34%</div>
          <div className="metric-sub">demand saat promo aktif</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg lead time</div>
          <div className="metric-value" style={{ color:"var(--amber)" }}>4.2d</div>
          <div className="metric-sub">across all suppliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Stockout rate</div>
          <div className="metric-value" style={{ color:"var(--red)" }}>{avgStockout}%</div>
          <div className="metric-sub" style={{ color:"var(--red)" }}>-2.1% vs periode lalu</div>
        </div>
      </div>

      {/* Row 1 (GRID 2) */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Demand: promo vs no promo</div>
          <p className="chart-sub">per store · avg daily demand</p>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background:"#7c6af7" }} />Promo aktif</div>
            <div className="legend-item"><span className="legend-dot" style={{ background:"#e2e8f0", border:"1px solid #7c6af7" }} />No promo</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={promoChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="store" tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="promo" name="Promo aktif" fill="#7c6af7" radius={[4,4,0,0]} />
              <Bar dataKey="noPromo" name="No promo" fill="#f1f5f9" stroke="#7c6af7" strokeWidth={1} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stockout risk vs weather impact</div>
          <p className="chart-sub">distribusi risiko per kondisi cuaca</p>
          <div className="chart-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background:"#f06292" }} />High risk</div>
            <div className="legend-item"><span className="legend-dot" style={{ background:"#f59e0b" }} />Medium</div>
            <div className="legend-item"><span className="legend-dot" style={{ background:"#10b981" }} />Low risk</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEATHER_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="weather" tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="high" name="High risk" stackId="a" fill="#f06292" />
              <Bar dataKey="medium" name="Medium" stackId="a" fill="#f59e0b" />
              <Bar dataKey="low" name="Low risk" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 (GRID 2) */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="chart-title">Supplier reliability score</div>
          <p className="chart-sub">ranking semua supplier aktif</p>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:16 }}>
            {SUPPLIERS.map(s => (
              <div key={s.name} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:12, color:"var(--text2)", width:60, fontWeight: 500 }}>{s.name}</span>
                <div style={{ flex:1, height:8, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${s.score}%`, background:supplierColor(s.score), borderRadius:4, transition:"width 0.6s ease" }} />
                </div>
                <span style={{ fontSize:12, color:supplierColor(s.score), width:30, fontWeight: 700 }}>{s.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Stok vs demand harian</div>
          <p className="chart-sub">30 hari terakhir · agregat semua store</p>
          <div className="chart-legend">
            <div className="legend-item"><span style={{ width:12, height:12, background:"#7c6af7", borderRadius: 2 }} /> Stok</div>
            <div className="legend-item"><span style={{ width:12, height:12, background:"#10b981", borderRadius: 2 }} /> Demand</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="stock" stroke="#7c6af7" strokeWidth={3} dot={{ r: 4, fill: "#7c6af7" }} activeDot={{ r: 6 }} name="Stok" />
              <Line type="monotone" dataKey="demand" stroke="#10b981" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, fill: "#10b981" }} name="Demand" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Store Table */}
      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 16 }}>Performa per store</p>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Analisis distribusi stok dan risiko per cabang</p>
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
              {storeTableData.map(d => {
                const rateColor = d.stockoutRate > 25 ? "var(--red)" : d.stockoutRate > 15 ? "var(--amber)" : "var(--green)";
                const rateBg = d.stockoutRate > 25 ? "#fef2f2" : d.stockoutRate > 15 ? "#fffbeb" : "#ecfdf5";
                const status = d.stockoutRate > 25 ? "Kritis" : d.stockoutRate > 15 ? "Pantau" : "Aman";
                return (
                  <tr key={d.store}>
                    <td style={{ fontWeight: 700, color: "var(--accent)" }}>{d.store}</td>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ flex:1, height:6, background:"#f1f5f9", borderRadius:3, maxWidth:100 }}>
                          <div style={{ height:"100%", width:`${d.stockoutRate}%`, background:rateColor, borderRadius:3 }} />
                        </div>
                        <span style={{ fontWeight: 600, color: rateColor }}>{d.stockoutRate}%</span>
                      </div>
                    </td>
                    <td>{d.avgDemand} unit</td>
                    <td>{d.avgStock} unit</td>
                    <td>
                      <span style={{ padding:"4px 12px", borderRadius:20, background:rateBg, color:rateColor, fontSize:11, fontWeight: 700 }}>
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