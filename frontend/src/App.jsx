import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Analytics from "./pages/Analytics";
import AIChat from "./pages/AIChat";
import Login from "./pages/Login";
import { isLoggedIn, getUser, logout } from "./api";
import "./App.css";

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const display = user?.name || user?.email || "User";
  const initial = display.charAt(0).toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          background: "transparent", border: "1px solid var(--border)",
          borderRadius: 20, padding: "5px 10px 5px 5px",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: "var(--accent)",
          color: "#fff", fontSize: 12, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{initial}</div>
        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 50,
            background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)", minWidth: 180, overflow: "hidden",
          }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: 0 }}>{display}</p>
              {user?.email && <p style={{ fontSize: 11, color: "var(--text2)", margin: "2px 0 0" }}>{user.email}</p>}
            </div>
            <button
              onClick={onLogout}
              style={{
                width: "100%", textAlign: "left", padding: "11px 14px", border: "none",
                background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--red)", fontWeight: 600,
              }}
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          </svg>
        </div>
        <span className="brand-name">Stock Sense</span>
        <span className="brand-badge">AI</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Dashboard</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Products</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Analytics</NavLink>
        <NavLink to="/ai-chat" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>AI Chat</NavLink>
      </div>
      <UserMenu user={user} onLogout={onLogout} />
    </nav>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const handleLogout = () => {
    logout();
    setAuthed(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar user={getUser()} onLogout={handleLogout} />
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