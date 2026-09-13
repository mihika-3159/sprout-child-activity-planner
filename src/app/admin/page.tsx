"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SourceItem {
  id: string;
  source_name: string;
  source_url: string;
  license: string;
  review_status: string;
  commercial_reuse_allowed: number;
}

interface ChunkItem {
  id: string;
  source_title: string;
  chunk_text: string;
  developmental_domains: string;
  evidence_strength: string;
  approval_status: string;
  age_range_min: number;
  age_range_max: number;
}

interface AuditItem {
  id: number;
  activity_id: string;
  safety_classification: string;
  grounding_validation_result: string;
  created_at: string;
}

interface FeedbackItem {
  id: number;
  session_id: string;
  rating: number;
  feedback: string;
  category: string;
  resolved: number;
  created_at: string;
}

export default function AdminPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [avgRating, setAvgRating] = useState<number>(5.0);
  const [adminEmail, setAdminEmail] = useState<string>("mihika3109@gmail.com");
  const [activeTab, setActiveTab] = useState<"feedback" | "evidence" | "audits" | "cost">("feedback");
  const [loading, setLoading] = useState(true);

  // New source form state
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceLicense, setNewSourceLicense] = useState("CC_BY");

  useEffect(() => {
    async function loadData() {
      try {
        const [evRes, auditRes, fbRes] = await Promise.all([
          fetch("/api/admin/evidence"),
          fetch("/api/admin/audits"),
          fetch("/api/admin/feedback"),
        ]);
        const evData = await evRes.json();
        const auditData = await auditRes.json();
        const fbData = await fbRes.json();

        setSources(evData.sources || []);
        setChunks(evData.chunks || []);
        setAudits(auditData.audits || []);
        setFeedbacks(fbData.feedback || []);
        if (fbData.averageRating) setAvgRating(fbData.averageRating);
        if (fbData.adminAccount) setAdminEmail(fbData.adminAccount);
      } catch (err) {
        console.error("Admin load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleUpdateStatus = async (chunkId: string, status: string) => {
    await fetch("/api/admin/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", chunkId, status }),
    });
    setChunks(chunks.map((c) => (c.id === chunkId ? { ...c, approval_status: status } : c)));
  };

  const handleResolveFeedback = async (feedbackId: number, resolved: boolean) => {
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId, resolved }),
    });
    setFeedbacks(feedbacks.map((f) => (f.id === feedbackId ? { ...f, resolved: resolved ? 1 : 0 } : f)));
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName || !newSourceUrl) return;
    const res = await fetch("/api/admin/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_source",
        sourceName: newSourceName,
        sourceUrl: newSourceUrl,
        license: newSourceLicense,
      }),
    });
    if (res.ok) {
      alert("Source submitted. Checked against commercial allowlist.");
      window.location.reload();
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)", paddingBottom: "4rem" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--color-stone-900)",
          color: "white",
          padding: "1rem 0",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/" style={{ color: "white", textDecoration: "none", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              🌱 Sprout Admin
            </Link>
            <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: "10px", color: "var(--color-amber-200)" }}>
              Admin: <strong>{adminEmail}</strong>
            </span>
          </div>
          <Link href="/" className="btn btn-ghost btn-sm" style={{ color: "white" }}>
            Exit Admin
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: "2rem" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--color-stone-300)", marginBottom: "2rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`btn btn-sm ${activeTab === "feedback" ? "btn-primary" : "btn-ghost"}`}
          >
            💬 User Feedback & Beta Reviews ({feedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`btn btn-sm ${activeTab === "evidence" ? "btn-primary" : "btn-ghost"}`}
          >
            📚 Evidence Corpus ({chunks.length})
          </button>
          <button
            onClick={() => setActiveTab("audits")}
            className={`btn btn-sm ${activeTab === "audits" ? "btn-primary" : "btn-ghost"}`}
          >
            🔍 Generation Audits ({audits.length})
          </button>
          <button
            onClick={() => setActiveTab("cost")}
            className={`btn btn-sm ${activeTab === "cost" ? "btn-primary" : "btn-ghost"}`}
          >
            💰 Infrastructure Audit
          </button>
        </div>

        {/* Tab 0: User Feedback & Beta Reviews */}
        {activeTab === "feedback" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Feedback Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div className="card" style={{ padding: "1.25rem", background: "white" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-500)", marginBottom: "0.25rem" }}>Total Submissions</p>
                <h3 style={{ fontSize: "1.75rem", fontFamily: "'Outfit', sans-serif", color: "var(--color-stone-900)" }}>{feedbacks.length}</h3>
              </div>
              <div className="card" style={{ padding: "1.25rem", background: "white" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-500)", marginBottom: "0.25rem" }}>Average Star Rating</p>
                <h3 style={{ fontSize: "1.75rem", fontFamily: "'Outfit', sans-serif", color: "var(--color-amber-600)" }}>
                  ★ {avgRating} / 5.0
                </h3>
              </div>
              <div className="card" style={{ padding: "1.25rem", background: "white" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-stone-500)", marginBottom: "0.25rem" }}>Admin Access Level</p>
                <h3 style={{ fontSize: "1rem", fontFamily: "'Outfit', sans-serif", color: "var(--color-sage-700)", marginTop: "0.5rem" }}>
                  Primary Admin ({adminEmail})
                </h3>
              </div>
            </div>

            {/* Feedback Table */}
            <div className="card" style={{ padding: "1.5rem", background: "white" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                Community Feedback Entries
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-stone-500)", marginBottom: "1.25rem" }}>
                Direct responses from parents testing the Sprout Activity Planner in live demo and production.
              </p>

              {feedbacks.length === 0 ? (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--color-stone-400)" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🌱</p>
                  <p>No user feedback entries recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {feedbacks.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: `1px solid ${item.resolved ? "var(--color-success)" : "var(--color-stone-200)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem",
                        background: item.resolved ? "rgba(34,197,94,0.04)" : "var(--color-cream-50)",
                        opacity: item.resolved ? 0.8 : 1,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ color: "var(--color-amber-500)", fontWeight: 700, fontSize: "1.125rem" }}>
                            {"★".repeat(item.rating)}{"☆".repeat(Math.max(0, 5 - item.rating))}
                          </span>
                          <span
                            style={{
                              background: "var(--color-sage-100)",
                              color: "var(--color-sage-800)",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {item.category.replace(/_/g, " ")}
                          </span>
                          {item.resolved ? (
                            <span style={{ background: "var(--color-sage-100)", color: "var(--color-sage-700)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 600 }}>
                              ✓ Resolved
                            </span>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-stone-400)" }}>
                            {item.created_at ? new Date(item.created_at).toLocaleString() : "Just now"}
                          </span>
                          <button
                            onClick={() => handleResolveFeedback(item.id, !item.resolved)}
                            className={`btn btn-sm ${item.resolved ? "btn-ghost" : "btn-secondary"}`}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                          >
                            {item.resolved ? "↩ Unresolve" : "✓ Mark Resolved"}
                          </button>
                        </div>
                      </div>

                      <p style={{ color: "var(--color-stone-800)", fontSize: "0.9375rem", lineHeight: 1.55, margin: "0.5rem 0" }}>
                        {item.feedback || <em style={{ color: "var(--color-stone-400)" }}>No written comment provided.</em>}
                      </p>

                      <div style={{ fontSize: "0.75rem", color: "var(--color-stone-400)", marginTop: "0.5rem" }}>
                        Session: <code>{item.session_id ? item.session_id.slice(0, 10) + "..." : "anonymous"}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Evidence Corpus Management */}
        {activeTab === "evidence" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Add Source Form */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", marginBottom: "1rem" }}>
                Add Verified Evidence Source (Subject to License Allowlist)
              </h3>
              <form onSubmit={handleAddSource} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px auto", gap: "0.75rem", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Source Name (e.g. PMC Journal Article)"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="input"
                  required
                />
                <input
                  type="url"
                  placeholder="https://ncbi.nlm.nih.gov/pmc/..."
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="input"
                  required
                />
                <select
                  value={newSourceLicense}
                  onChange={(e) => setNewSourceLicense(e.target.value)}
                  className="input"
                  style={{ background: "white" }}
                >
                  <option value="CC_BY">CC BY (Approved)</option>
                  <option value="CC0">CC0 (Approved)</option>
                  <option value="PUBLIC_DOMAIN">Public Domain (Approved)</option>
                  <option value="CC_BY_SA">CC BY-SA (Needs Review)</option>
                  <option value="CC_BY_NC">CC BY-NC (Blocked)</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm">
                  Register Source
                </button>
              </form>
            </div>

            {/* Approved Evidence Chunks List */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", marginBottom: "1rem" }}>
                Indexed Evidence Chunks
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    style={{
                      border: "1px solid var(--color-stone-200)",
                      borderRadius: "var(--radius-md)",
                      padding: "1rem",
                      background: "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{chunk.source_title}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-stone-400)", marginLeft: "0.5rem" }}>
                          Ages {chunk.age_range_min}–{chunk.age_range_max}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <span className={`evidence-badge ${chunk.approval_status === "approved" ? "evidence-badge-strong" : "evidence-badge-limited"}`}>
                          {chunk.approval_status}
                        </span>
                        {chunk.approval_status === "approved" ? (
                          <button
                            onClick={() => handleUpdateStatus(chunk.id, "rejected")}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "0.75rem", color: "var(--color-error)" }}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(chunk.id, "approved")}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem" }}
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-stone-600)", lineHeight: 1.5 }}>
                      {chunk.chunk_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Activity Audits */}
        {activeTab === "audits" && (
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", marginBottom: "1rem" }}>
              Recent Generation Validation Audits
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-stone-500)", marginBottom: "1rem" }}>
              All activities undergo automatic validation against evidence grounding, age appropriateness, and safety.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-stone-300)", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem" }}>Audit ID</th>
                    <th style={{ padding: "0.5rem" }}>Activity ID</th>
                    <th style={{ padding: "0.5rem" }}>Supervision Classification</th>
                    <th style={{ padding: "0.5rem" }}>Validation Result</th>
                    <th style={{ padding: "0.5rem" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--color-stone-200)" }}>
                      <td style={{ padding: "0.5rem" }}>#{a.id}</td>
                      <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{a.activity_id?.slice(0, 8)}...</td>
                      <td style={{ padding: "0.5rem" }}>{a.safety_classification}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <span style={{ color: a.grounding_validation_result === "passed" ? "var(--color-success)" : "var(--color-error)", fontWeight: 600 }}>
                          {a.grounding_validation_result}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem", color: "var(--color-stone-400)", fontSize: "0.75rem" }}>
                        {new Date(a.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Cost Audit */}
        {activeTab === "cost" && (
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.125rem", marginBottom: "0.5rem" }}>
              Zero-Upfront-Cost Infrastructure Audit (Spec Section 34C)
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-stone-500)", marginBottom: "1.5rem" }}>
              Every dependency operates strictly within free-tier or open-source limits. No surprise bills.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-stone-300)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Component</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Provider</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Free Tier Status</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Hard Limit Safeguard</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Paid Fallback Allowed?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { comp: "LLM Inference", prov: "Gemini 2.0 Flash-Lite / Free Open Model", tier: "Yes (Free Tier)", limit: "App-level rate limiter & token budgets", paid: "NO (Blocked)" },
                  { comp: "Embeddings", prov: "Local Deterministic Vector Hashing", tier: "Yes (100% Free / Local)", limit: "Node.js In-Memory", paid: "NO (Zero API Cost)" },
                  { comp: "Database & Vectors", prov: "SQLite + In-Memory Cosine Vector Search", tier: "Yes (Free / Local File)", limit: "Local Disk Space", paid: "NO" },
                  { comp: "Evidence Retrieval", prov: "PubMed Central OA / CDC / ERIC", tier: "Yes (Open Access APIs)", limit: "API-specific rate limits", paid: "NO" },
                  { comp: "PDF / Print", prov: "Print-to-PDF & HTML Media CSS", tier: "Yes (Open Source)", limit: "Browser Render Engine", paid: "NO" },
                  { comp: "Hosting", prov: "Vercel Free Tier", tier: "Yes", limit: "Vercel Hobby Allowance", paid: "NO" },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--color-stone-200)" }}>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>{row.comp}</td>
                    <td style={{ padding: "0.75rem 0.5rem" }}>{row.prov}</td>
                    <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-success)" }}>✓ {row.tier}</td>
                    <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-stone-600)" }}>{row.limit}</td>
                    <td style={{ padding: "0.75rem 0.5rem", fontWeight: 700, color: "var(--color-stone-900)" }}>{row.paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
