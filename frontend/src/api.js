import axios from "axios";

const BASE = "https://ivanaharsono-stocksense-api.hf.space";

// ── Workspace key: dibuat otomatis sekali, lalu disimpan di browser ──────────
export function getWorkspaceId() {
  let id = localStorage.getItem("workspace_id");
  if (!id) {
    id = "ws_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem("workspace_id", id);
  }
  return id;
}

// Ganti workspace (misal user mau join workspace tim lewat key yang dishare)
export function setWorkspaceId(id) {
  if (id && id.trim()) {
    localStorage.setItem("workspace_id", id.trim());
  }
}

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// Tiap request otomatis bawa workspace key
api.interceptors.request.use((config) => {
  config.headers["X-Workspace-Id"] = getWorkspaceId();
  return config;
});

// PRODUCTS
export const getProducts        = ()       => api.get("/products");
export const getProduct         = (id)     => api.get(`/products/${id}`);
export const saveProduct        = (payload)=> api.post("/products", payload);

// DASHBOARD
export const getDashboardStats  = ()       => api.get("/dashboard/stats");
export const getDemandTrend     = (days=7) => api.get(`/dashboard/trend?days=${days}`);

// ANALYTICS
export const getStorePerformance = () => api.get("/analytics/stores");
export const getSupplierStats    = () => api.get("/analytics/suppliers");

// AI
export const getAiPrediction = async (productId) => {
  const res = await api.get(`/ai/predict/${productId}`);
  return res.data;
};

export { BASE };
export default api;