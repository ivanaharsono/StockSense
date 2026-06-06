import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 10000,
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

// AI — satu fungsi, pakai instance api (bukan axios langsung)
export const getAiPrediction = async (productId) => {
  const res = await api.get(`/ai/predict/${productId}`);
  return res.data;
};

export default api;