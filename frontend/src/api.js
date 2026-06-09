import axios from "axios";

const BASE = "https://ivanaharsono-stocksense-api.hf.space";

// ── Workspace key (dipakai user anonim + dipakai juga setelah login) ──────────
export function getWorkspaceId() {
  let id = localStorage.getItem("workspace_id");
  if (!id) {
    id = "ws_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem("workspace_id", id);
  }
  return id;
}
export function setWorkspaceId(id) {
  if (id && id.trim()) localStorage.setItem("workspace_id", id.trim());
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
export function getToken()    { return localStorage.getItem("token"); }
export function isLoggedIn()  { return !!localStorage.getItem("token"); }
export function getUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}

function saveSession({ token, email, name, workspace_id }) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify({ email, name }));
  setWorkspaceId(workspace_id);   // selaraskan workspace dgn akun
}

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  saveSession(res.data);
  return res.data;
}
export async function register(email, password, name) {
  const res = await api.post("/auth/register", { email, password, name });
  saveSession(res.data);
  return res.data;
}
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("workspace_id");  // workspace baru akan dibuat saat anonim lagi
  localStorage.removeItem("lastUploadedExcel");
}

// ── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({ baseURL: BASE, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  config.headers["X-Workspace-Id"] = getWorkspaceId();
  return config;
});

// Kalau token kedaluwarsa / tidak valid → otomatis logout
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && getToken()) {
      logout();
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

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