import { useState, useMemo } from "react";

const ALL_PRODUCTS = [
  { product_id:"PRD-0821", store_id:"S-07", current_stock:42, daily_demand:89, lead_time_days:5, supplier_reliability_score:62, weather_impact:"High", promotion_active:"Yes", stockout_risk:"High" },
  { product_id:"PRD-1432", store_id:"S-03", current_stock:18, daily_demand:55, lead_time_days:7, supplier_reliability_score:71, weather_impact:"High", promotion_active:"No", stockout_risk:"High" },
  { product_id:"PRD-0093", store_id:"S-11", current_stock:67, daily_demand:98, lead_time_days:4, supplier_reliability_score:58, weather_impact:"High", promotion_active:"Yes", stockout_risk:"High" },
  { product_id:"PRD-2210", store_id:"S-02", current_stock:130, daily_demand:88, lead_time_days:3, supplier_reliability_score:84, weather_impact:"Medium", promotion_active:"No", stockout_risk:"Medium" },
  { product_id:"PRD-0554", store_id:"S-09", current_stock:210, daily_demand:74, lead_time_days:2, supplier_reliability_score:91, weather_impact:"Low", promotion_active:"Yes", stockout_risk:"Low" },
  { product_id:"PRD-3301", store_id:"S-01", current_stock:55, daily_demand:110, lead_time_days:6, supplier_reliability_score:67, weather_impact:"High", promotion_active:"Yes", stockout_risk:"High" },
  { product_id:"PRD-0782", store_id:"S-05", current_stock:340, daily_demand:60, lead_time_days:2, supplier_reliability_score:95, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-1901", store_id:"S-08", current_stock:88, daily_demand:92, lead_time_days:4, supplier_reliability_score:79, weather_impact:"Medium", promotion_active:"Yes", stockout_risk:"Medium" },
  { product_id:"PRD-0445", store_id:"S-04", current_stock:24, daily_demand:78, lead_time_days:8, supplier_reliability_score:55, weather_impact:"High", promotion_active:"No", stockout_risk:"High" },
  { product_id:"PRD-2087", store_id:"S-10", current_stock:195, daily_demand:44, lead_time_days:3, supplier_reliability_score:88, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-1123", store_id:"S-06", current_stock:63, daily_demand:101, lead_time_days:5, supplier_reliability_score:72, weather_impact:"Medium", promotion_active:"Yes", stockout_risk:"High" },
  { product_id:"PRD-0670", store_id:"S-12", current_stock:280, daily_demand:55, lead_time_days:2, supplier_reliability_score:93, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-3456", store_id:"S-07", current_stock:37, daily_demand:82, lead_time_days:6, supplier_reliability_score:61, weather_impact:"High", promotion_active:"Yes", stockout_risk:"High" },
  { product_id:"PRD-0910", store_id:"S-03", current_stock:145, daily_demand:68, lead_time_days:3, supplier_reliability_score:86, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-2234", store_id:"S-09", current_stock:72, daily_demand:95, lead_time_days:4, supplier_reliability_score:76, weather_impact:"Medium", promotion_active:"Yes", stockout_risk:"Medium" },
  { product_id:"PRD-1567", store_id:"S-11", current_stock:29, daily_demand:71, lead_time_days:7, supplier_reliability_score:59, weather_impact:"High", promotion_active:"No", stockout_risk:"High" },
  { product_id:"PRD-0334", store_id:"S-02", current_stock:410, daily_demand:38, lead_time_days:1, supplier_reliability_score:97, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-2891", store_id:"S-05", current_stock:91, daily_demand:87, lead_time_days:4, supplier_reliability_score:74, weather_impact:"Medium", promotion_active:"Yes", stockout_risk:"Medium" },
  { product_id:"PRD-0123", store_id:"S-01", current_stock:160, daily_demand:52, lead_time_days:2, supplier_reliability_score:90, weather_impact:"Low", promotion_active:"No", stockout_risk:"Low" },
  { product_id:"PRD-4100", store_id:"S-08", current_stock:44, daily_demand:93, lead_time_days:5, supplier_reliability_score:64, weather_impact:"High", promotion_active:"Yes", stockout_risk:"High" },
];

const PER_PAGE = 10;

function SupplierBar({ score }) {
  const color = score >= 80 ? "var(--green)" : score >= 65 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{score}</span>
    </div>
  );
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [weatherFilter, setWeatherFilter] = useState("");
  const [promoFilter, setPromoFilter] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState(1);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let data = ALL_PRODUCTS.filter(p => {
      const matchSearch = !search || p.product_id.toLowerCase().includes(search.toLowerCase()) || p.store_id.toLowerCase().includes(search.toLowerCase());
      const matchRisk = !riskFilter || p.stockout_risk === riskFilter;
      const matchWeather = !weatherFilter || p.weather_impact === weatherFilter;
      const matchPromo = !promoFilter || p.promotion_active === promoFilter;
      return matchSearch && matchRisk && matchWeather && matchPromo;
    });
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number") return (av - bv) * sortDir;
        return av.localeCompare(bv) * sortDir;
      });
    }
    return data;
  }, [search, riskFilter, weatherFilter, promoFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  function clearFilters() {
    setSearch(""); setRiskFilter(""); setWeatherFilter(""); setPromoFilter(""); setPage(1);
  }

  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";

  const highCount = filtered.filter(p => p.stockout_risk === "High").length;
  const medCount = filtered.filter(p => p.stockout_risk === "Medium").length;
  const lowCount = filtered.filter(p => p.stockout_risk === "Low").length;

  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Products</h1>
          <p>Inventory management — {filtered.length} items</p>
        </div>
        <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add product
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search product ID or store..." style={{ width: 220 }} />
        <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }}>
          <option value="">All risk levels</option>
          <option value="High">High risk</option>
          <option value="Medium">Medium risk</option>
          <option value="Low">Low risk</option>
        </select>
        <select value={weatherFilter} onChange={e => { setWeatherFilter(e.target.value); setPage(1); }}>
          <option value="">All weather</option>
          <option value="High">High impact</option>
          <option value="Medium">Medium impact</option>
          <option value="Low">Low impact</option>
        </select>
        <select value={promoFilter} onChange={e => { setPromoFilter(e.target.value); setPage(1); }}>
          <option value="">All promo</option>
          <option value="Yes">Promo active</option>
          <option value="No">No promo</option>
        </select>
        <button className="btn btn-ghost" onClick={clearFilters}>Clear</button>
      </div>

      {/* Risk Summary */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="metric-card" style={{ borderColor: "rgba(240,98,146,0.2)" }}>
          <div className="metric-label">High risk</div>
          <div className="metric-value" style={{ color: "var(--red)", fontSize: 24 }}>{highCount}</div>
        </div>
        <div className="metric-card" style={{ borderColor: "rgba(245,166,35,0.2)" }}>
          <div className="metric-label">Medium risk</div>
          <div className="metric-value" style={{ color: "var(--amber)", fontSize: 24 }}>{medCount}</div>
        </div>
        <div className="metric-card" style={{ borderColor: "rgba(45,212,160,0.2)" }}>
          <div className="metric-label">Low risk</div>
          <div className="metric-value" style={{ color: "var(--green)", fontSize: 24 }}>{lowCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("product_id")}>PRODUCT ID{sortIcon("product_id")}</th>
                <th className="sortable" onClick={() => handleSort("store_id")}>STORE{sortIcon("store_id")}</th>
                <th className="sortable" style={{ textAlign: "right" }} onClick={() => handleSort("current_stock")}>STOCK{sortIcon("current_stock")}</th>
                <th className="sortable" style={{ textAlign: "right" }} onClick={() => handleSort("daily_demand")}>DEMAND{sortIcon("daily_demand")}</th>
                <th className="sortable" style={{ textAlign: "right" }} onClick={() => handleSort("lead_time_days")}>LEAD TIME{sortIcon("lead_time_days")}</th>
                <th className="sortable" style={{ textAlign: "right" }} onClick={() => handleSort("supplier_reliability_score")}>SUPPLIER{sortIcon("supplier_reliability_score")}</th>
                <th style={{ textAlign: "center" }}>WEATHER</th>
                <th style={{ textAlign: "center" }}>PROMO</th>
                <th style={{ textAlign: "center" }}>RISK</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text2)" }}>No products found</td></tr>
              ) : paginated.map(p => {
                const daysLeft = p.daily_demand > 0 ? Math.round(p.current_stock / p.daily_demand) : 99;
                return (
                  <tr key={p.product_id}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent2)" }}>{p.product_id}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>{p.store_id}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: p.current_stock < 50 ? "var(--red)" : p.current_stock < 100 ? "var(--amber)" : "var(--text)" }}>{p.current_stock}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{p.daily_demand}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                      {p.lead_time_days}d <span style={{ color: "var(--text2)", fontSize: 11 }}>({daysLeft}d left)</span>
                    </td>
                    <td style={{ textAlign: "right" }}><SupplierBar score={p.supplier_reliability_score} /></td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge badge-${p.weather_impact.toLowerCase()}`}>{p.weather_impact}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {p.promotion_active === "Yes"
                        ? <span className="badge badge-accent">Active</span>
                        : <span style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge badge-${p.stockout_risk.toLowerCase()}`}>{p.stockout_risk}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="page-info">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ opacity: page === 1 ? 0.3 : 1, padding: "5px 14px" }}>← Prev</button>
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ opacity: page >= totalPages ? 0.3 : 1, padding: "5px 14px" }}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}