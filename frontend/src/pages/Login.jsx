import { useState } from "react";
import { login, register } from "../api";

export default function Login({ onSuccess }) {
  const [mode, setMode]         = useState("login");   // "login" | "register"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else                  await register(email.trim(), password, name.trim());
      onSuccess ? onSuccess() : window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") submit(); };

  const field = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1.5px solid var(--border)", fontSize: 14, color: "var(--text)",
    background: "#fff", outline: "none", boxSizing: "border-box",
  };
  const label = { fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 5, display: "block" };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 100%)", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18,
        padding: "36px 32px", boxShadow: "0 20px 60px rgba(240,98,146,0.15)",
        border: "1px solid rgba(240,98,146,0.1)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--text)" }}>Stock Sense</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 26 }}>
          {mode === "login" ? "Sign in to your workspace" : "Create your workspace account"}
        </p>

        {mode === "register" && (
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Name (optional)</label>
            <input style={field} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKey} placeholder="Your name" />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Email</label>
          <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKey} placeholder="you@company.com" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>Password</label>
          <input style={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKey} placeholder="Enter your password" />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, padding: "10px 12px", borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: loading ? "#cbd5e1" : "var(--accent)", color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(240,98,146,0.3)", transition: "background 0.2s",
          }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 20 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            style={{ background: "none", border: "none", color: "var(--accent2)", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}