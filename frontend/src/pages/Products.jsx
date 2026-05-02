import { useState, useEffect, useMemo } from "react";
import api from "../api";

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
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [search, setSearch]           = useState("");
  const [riskFilter, setRiskFilter]   = useState("");
  const [weatherFilter, setWeatherFilter] = useState("");
  const [promoFilter, setPromoFilter] = useState("");
  const [sortKey, setSortKey]         = useState("");
  const [sortDir, setSortDir]         = useState(1);
  const [page, setPage]               = useState(1);
  
  // State untuk Modal Add Product
  const [showModal, setShowModal] = useState(false);
  const [newProd, setNewProd] = useState({ product_id: "", store_id: "", current_stock: "", daily_demand: "" });

  const handleSaveProduct = async () => {
    try {
      await api.post("/products", {
        ...newProd,
        current_stock: Number(newProd.current_stock),
        daily_demand: Number(newProd.daily_demand)
      });
      setShowModal(false);
      window.location.reload(); // Cara paling barbar dan cepet biar tabel langsung update
    } catch (err) {
      alert("Data gagal disimpan");
    }
  };

  useEffect(() => {
    api.get("/products")
      .then((res) => {
        let realData = [];
        if (Array.isArray(res.data)) realData = res.data;
        else if (Array.isArray(res.data?.data)) realData = res.data.data;
        else if (Array.isArray(res.data?.products)) realData = res.data.products;

        setAllProducts(realData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let data = Array.isArray(allProducts) ? allProducts : [];
    data = data.filter((p) => {
      const matchSearch =
        !search ||
        p.product_id.toLowerCase().includes(search.toLowerCase()) ||
        p.store_id.toLowerCase().includes(search.toLowerCase());
      const matchRisk    = !riskFilter    || p.stockout_risk      === riskFilter;
      const matchWeather = !weatherFilter || p.weather_impact     === weatherFilter;
      const matchPromo   = !promoFilter   || p.promotion_active   === promoFilter;
      return matchSearch && matchRisk && matchWeather && matchPromo;
    });

    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number") return (av - bv) * sortDir;
        if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
        return 0;
      });
    }
    return data;
  }, [allProducts, search, riskFilter, weatherFilter, promoFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  function clearFilters() {
    setSearch(""); setRiskFilter(""); setWeatherFilter(""); setPromoFilter(""); setPage(1);
  }

  const sortIcon = (key) => sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";

  const highCount = filtered.filter((p) => p.stockout_risk === "High" || p.stockout_risk === "Yes").length;
  const medCount  = filtered.filter((p) => p.stockout_risk === "Medium").length;
  const lowCount  = filtered.filter((p) => p.stockout_risk === "Low" || p.stockout_risk === "No").length;

  if (loading) return <p style={{ padding: 24 }}>Memuat produk...</p>;
  if (error)   return <p style={{ padding: 24, color: "var(--red)" }}>Error: {error}</p>;

  return (
    <div className="page fade-up">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Products</h1>
          <p>Inventory management — {filtered.length} items</p>
        </div>
        {/* Tombol Add Product - Dikasih onClick */}
        <button 
          className="btn btn-primary" 
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add product
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search product ID or store..."
          style={{ width: 220 }}
        />
        <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}>
          <option value="">All risk levels</option>
          <option value="High">High risk</option>
          <option value="Medium">Medium risk</option>
          <option value="Low">Low risk</option>
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
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text2)" }}>
                    No products found
                  </td>
                </tr>
              ) : paginated.map((p) => {
                const daysLeft = p.daily_demand > 0
                  ? Math.round(p.current_stock / p.daily_demand)
                  : 99;
                return (
                  <tr key={p.product_id}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent2)" }}>{p.product_id}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text2)" }}>{p.store_id}</td>
                    <td style={{
                      textAlign: "right",
                      fontFamily: "var(--mono)",
                      color: p.current_stock < 50 ? "var(--red)" : p.current_stock < 100 ? "var(--amber)" : "var(--text)",
                    }}>
                      {p.current_stock}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{p.daily_demand}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                      {p.lead_time_days}d <span style={{ color: "var(--text2)", fontSize: 11 }}>({daysLeft}d left)</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <SupplierBar score={p.supplier_reliability_score || 0} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge badge-${(p.weather_impact || "Low").toLowerCase()}`}>{p.weather_impact || "Low"}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {p.promotion_active === "Yes"
                        ? <span className="badge badge-accent">Active</span>
                        : <span style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge badge-${(p.stockout_risk || "Low").toLowerCase()}`}>{p.stockout_risk || "Low"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "16px 24px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          borderBottomLeftRadius: "8px",
          borderBottomRightRadius: "8px"
        }}>
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ 
                padding: "6px 14px", 
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: page === 1 ? "#f8fafc" : "white",
                color: page === 1 ? "#cbd5e1" : "#334155",
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontWeight: 600,
                transition: "all 0.2s"
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || totalPages === 0}
              style={{ 
                padding: "6px 14px", 
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: page >= totalPages || totalPages === 0 ? "#f8fafc" : "white",
                color: page >= totalPages || totalPages === 0 ? "#cbd5e1" : "#334155",
                cursor: page >= totalPages || totalPages === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
                transition: "all 0.2s"
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL ADD PRODUCT */}
      {showModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 999,
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            background: "#ffffff", padding: "24px", borderRadius: "12px", width: "320px",
            display: "flex", flexDirection: "column", gap: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
          }}>
            <h3 style={{ margin: 0, marginBottom: 8, color: "#1f2937", fontSize: "18px" }}>Add New Product</h3>
            
            <input
              placeholder="Product ID (e.g., P999)"
              value={newProd.product_id}
              onChange={e => setNewProd({...newProd, product_id: e.target.value.toUpperCase()})}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#1f2937" }}
            />
            <input
              placeholder="Store ID (e.g., S101)"
              value={newProd.store_id}
              onChange={e => setNewProd({...newProd, store_id: e.target.value.toUpperCase()})}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#1f2937" }}
            />
            <input
              type="number"
              placeholder="Current Stock"
              value={newProd.current_stock}
              onChange={e => setNewProd({...newProd, current_stock: e.target.value})}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#1f2937" }}
            />
            <input
              type="number"
              placeholder="Daily Demand"
              value={newProd.daily_demand}
              onChange={e => setNewProd({...newProd, daily_demand: e.target.value})}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#1f2937" }}
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button 
                onClick={handleSaveProduct} 
                style={{ background: "#2dd4a0", color: "white", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", flex: 1, fontWeight: "bold" }}
              >
                Save
              </button>
              <button 
                onClick={() => setShowModal(false)} 
                style={{ background: "#f43f5e", color: "white", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", flex: 1, fontWeight: "bold" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}