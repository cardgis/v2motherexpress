"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Connexion refusée.");
      }

      window.location.assign("/admin/catalogue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion refusée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper">
      <main className="page-main">
        <div className="uk-section-large uk-container" style={{ maxWidth: 720 }}>
          <div className="uk-card uk-card-default uk-card-body" style={{ borderRadius: 24, boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>Accès administrateur</div>
              <h1 style={{ margin: "8px 0 0", fontSize: 34, lineHeight: 1.1, fontWeight: 800 }}>Connexion sécurisée</h1>
              <p style={{ margin: "10px 0 0", color: "#475569" }}>Accès réservé aux administrateurs du catalogue et du stock par magasin.</p>
            </div>

            <form onSubmit={onSubmit} className="uk-form-stacked" style={{ display: "grid", gap: 16 }}>
              <div>
                <label className="uk-form-label">Email</label>
                <input className="uk-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="uk-form-label">Mot de passe</label>
                <input className="uk-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>

              {error ? (
                <div style={{ padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 600 }}>
                  {error}
                </div>
              ) : null}

              <button className="uk-button uk-button-danger" type="submit" disabled={loading} style={{ borderRadius: 12 }}>
                {loading ? "Connexion..." : "Accéder à l’espace admin"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
