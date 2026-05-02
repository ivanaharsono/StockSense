import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000", 
  timeout: 10000,
});

// PRODUCTS
export const getProducts = () => api.get("/products");
export const getProduct = (id) => api.get(`/products/${id}`);

// DASHBOARD
export const getDashboardStats = () => api.get("/dashboard/stats");
export const getDemandTrend = (days = 7) => api.get(`/dashboard/trend?days=${days}`);

// ANALYTICS
export const getAnalytics = () => api.get("/analytics");
export const getStorePerformance = () => api.get("/analytics/stores");
export const getSupplierStats = () => api.get("/analytics/suppliers");

// AI
export const askAI = (question) => api.post("/ai/query", { question });
export const getPrediction = (productId) => api.get(`/ai/predict/${productId}`);

export default api;

// Fungsi khusus buat nanya AI
export const getAiPrediction = async (productId) => {
  try {
    const response = await axios.get(`http://127.0.0.1:8000/ai/predict/${productId}`);
    return response.data;
  } catch (error) {
    console.error("Gagal mengambil prediksi AI:", error);
    throw error;
  }
};