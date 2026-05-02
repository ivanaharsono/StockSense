import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Analytics from "./pages/Analytics";
import AIChat from "./pages/AIChat";
import "./App.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          </svg>
        </div>
        <span className="brand-name">StockSense</span>
        <span className="brand-badge">AI</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Dashboard</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Products</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Analytics</NavLink>
        <NavLink to="/ai-chat" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>AI Chat</NavLink>
      </div>
      <div className="navbar-status">
        <div className="status-dot" />
        <span>API connected</span>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/ai-chat" element={<AIChat />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}