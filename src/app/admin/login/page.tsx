"use client";
import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        window.location.assign("/admin");
        return;
      }
      setError(response.status === 503 ? "Admin access has not been configured." : "Sign-in failed.");
    } catch {
      setError("Connection failed.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  return (
    <main className="container" style={{ maxWidth: 460, paddingTop: "4rem" }}>
      <h1>Sprout admin sign-in</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label htmlFor="admin-password">Administrator password</label>
        <input id="admin-password" className="input" type="password"
          autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
