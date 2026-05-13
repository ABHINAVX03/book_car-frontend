import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminRevenue } from "../services/api";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const commissionPct = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`;
const driverPct = `${Math.round((1 - PLATFORM_COMMISSION_RATE) * 100)}%`;

const PAYMENT_COLORS = { WALLET: "#6366f1", CASH: "#10b981", CARD: "#f59e0b", UPI: "#3b82f6" };

export default function AdminRevenuePage({ toast }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await getAdminRevenue(p, PAGE_SIZE);
      setData(res);
    } catch (e) {
      toast?.error(e.message || "Could not load revenue data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page]);

  if (!isAdmin) {
    return (
      <div className="fade-in">
        <div className="premium-hero-panel" style={{ background: "var(--chrome-bg)", padding: "3rem 1.5rem" }}>
          <div className="animated-grid" />
          <div className="page-wrap" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
            <h1 style={{ color: "#fff" }}>Admin Access Only</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.5rem" }}>
              This page is restricted to BookCar administrators.
            </p>
            <button className="btn btn-dark" style={{ marginTop: "1.5rem" }} onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data ? [
    {
      label: "Total Completed Rides",
      value: data.totalCompletedRides ?? 0,
      icon: "🚗",
      color: "#6366f1",
      isCount: true,
    },
    {
      label: "Total Fare Collected",
      value: data.totalFareCollected ?? 0,
      icon: "💰",
      color: "#10b981",
      sub: "Paid by riders",
    },
    {
      label: `BookCar Revenue (${commissionPct})`,
      value: data.totalCommissionEarned ?? 0,
      icon: "🏢",
      color: "#f59e0b",
      sub: "Platform commission",
      highlight: true,
    },
    {
      label: `Driver Payouts (${driverPct})`,
      value: data.totalDriverPayouts ?? 0,
      icon: "👤",
      color: "#3b82f6",
      sub: "Paid to drivers",
    },
  ] : [];

  // Mini bar chart from rides
  const chartData = (data?.rides || []).slice(0, 10).reverse().map(r => ({
    id: `#${r.rideId}`,
    fare: r.totalFare || 0,
    commission: r.platformCommission || 0,
    payout: r.driverPayout || 0,
  }));
  const maxFare = Math.max(...chartData.map(d => d.fare), 1);

  return (
    <div className="fade-in">
      {/* HERO */}
      <div style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        padding: "2.5rem 1.5rem 5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div className="animated-grid" />
        {/* Orbs */}
        <div style={{ position: "absolute", top: -60, right: -40, width: 300, height: 300, background: "#f59e0b", borderRadius: "50%", opacity: 0.06, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: -40, left: "15%", width: 220, height: 220, background: "#6366f1", borderRadius: "50%", opacity: 0.08, filter: "blur(40px)" }} />

        <div className="page-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.75rem" }}>
            <span className="badge" style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
              🏢 Admin
            </span>
            <span className="badge badge-gray" style={{ fontSize: "0.72rem" }}>
              Commission: {commissionPct}
            </span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "2.2rem", letterSpacing: "-1px", marginBottom: "0.5rem" }}>
            Revenue Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
            BookCar platform earnings · All completed rides · Live data
          </p>
        </div>
      </div>

      <div className="app-shell-content">
        <div className="page-wrap">

          {/* SUMMARY CARDS */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: "2rem",
            marginTop: "-2.5rem",
          }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card" style={{ padding: "1.5rem" }}>
                    <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 12 }} />
                    <div className="skeleton-shimmer" style={{ width: "60%", height: 14, borderRadius: 4, marginBottom: 8 }} />
                    <div className="skeleton-shimmer" style={{ width: "80%", height: 26, borderRadius: 4 }} />
                  </div>
                ))
              : summary.map((s) => (
                  <div
                    key={s.label}
                    className="card"
                    style={{
                      padding: "1.5rem",
                      border: s.highlight ? `2px solid ${s.color}40` : "1px solid var(--surface-2)",
                      background: s.highlight ? `linear-gradient(135deg, ${s.color}10, var(--surface))` : "var(--surface)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {s.highlight && (
                      <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: s.color, borderRadius: "0 0 0 100%", opacity: 0.08 }} />
                    )}
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{s.icon}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontFamily: "Clash Display", fontSize: "1.6rem", fontWeight: 700, color: s.highlight ? s.color : "var(--text-primary)", letterSpacing: "-0.5px" }}>
                      {s.isCount ? s.value.toLocaleString() : fmtShort(s.value)}
                    </div>
                    {s.sub && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>{s.sub}</div>}
                  </div>
                ))}
          </div>

          {/* MINI BAR CHART */}
          {!loading && chartData.length > 0 && (
            <div className="card premium-card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
              <div className="section-heading" style={{ marginBottom: "1.25rem" }}>
                <div className="section-heading-copy">
                  <h3>Fare breakdown — last {chartData.length} rides</h3>
                  <p>Green = BookCar revenue · Blue = Driver payout</p>
                </div>
                <span className="badge" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                  {commissionPct} commission
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 4 }}>
                {chartData.map((d) => (
                  <div key={d.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, height: Math.round((d.fare / maxFare) * 100) }}>
                      <div style={{ flex: d.commission / d.fare, background: "#f59e0b", borderRadius: "4px 4px 0 0", minHeight: 4 }} title={`Commission: ${fmt(d.commission)}`} />
                      <div style={{ flex: d.payout / d.fare, background: "#3b82f6", borderRadius: 0, minHeight: 4 }} title={`Driver: ${fmt(d.payout)}`} />
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "var(--muted)", marginTop: 4, whiteSpace: "nowrap" }}>{d.id}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--muted)" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} /> BookCar ({commissionPct})
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--muted)" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#3b82f6" }} /> Driver ({driverPct})
                </div>
              </div>
            </div>
          )}

          {/* RIDES TABLE */}
          <div className="card premium-card" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
            <div className="section-heading" style={{ marginBottom: "1.25rem" }}>
              <div className="section-heading-copy">
                <h3>Completed ride ledger</h3>
                <p>
                  {loading
                    ? "Loading..."
                    : `${data?.totalElements ?? 0} total completed rides · Page ${page + 1} of ${data?.totalPages ?? 1}`}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => load(page)} disabled={loading}>
                {loading ? <span className="spinner" /> : "↻ Refresh"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--surface-2)" }}>
                    {["Ride ID", "Completed At", "Rider", "Driver", "Method", "Total Fare", `BookCar (${commissionPct})`, `Driver (${driverPct})`].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.6rem 0.75rem",
                          color: "var(--muted)",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--surface-2)" }}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} style={{ padding: "0.75rem" }}>
                              <div className="skeleton-shimmer" style={{ width: j === 2 || j === 3 ? 100 : 70, height: 14, borderRadius: 4 }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : (data?.rides || []).length === 0
                    ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
                            No completed rides yet
                          </td>
                        </tr>
                      )
                    : (data?.rides || []).map((ride, idx) => (
                        <tr
                          key={ride.rideId}
                          style={{
                            borderBottom: "1px solid var(--surface-2)",
                            background: idx % 2 === 0 ? "transparent" : "var(--surface)04",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)30"}
                          onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--surface)04"}
                        >
                          <td style={{ padding: "0.75rem", fontFamily: "Clash Display", fontWeight: 600, color: "var(--brand)" }}>
                            #{ride.rideId}
                          </td>
                          <td style={{ padding: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                            {ride.endedAt || ride.createdTime || "—"}
                          </td>
                          <td style={{ padding: "0.75rem", fontWeight: 500 }}>{ride.riderName}</td>
                          <td style={{ padding: "0.75rem", fontWeight: 500 }}>{ride.driverName}</td>
                          <td style={{ padding: "0.75rem" }}>
                            <span style={{
                              padding: "2px 10px",
                              borderRadius: 20,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              background: `${PAYMENT_COLORS[ride.paymentMethod] || "#888"}20`,
                              color: PAYMENT_COLORS[ride.paymentMethod] || "var(--muted)",
                            }}>
                              {ride.paymentMethod}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem", fontWeight: 700 }}>{fmt(ride.totalFare)}</td>
                          <td style={{ padding: "0.75rem", fontWeight: 700, color: "#f59e0b" }}>
                            {fmt(ride.platformCommission)}
                          </td>
                          <td style={{ padding: "0.75rem", color: "#3b82f6", fontWeight: 600 }}>
                            {fmt(ride.driverPayout)}
                          </td>
                        </tr>
                      ))}
                </tbody>
                {!loading && (data?.rides || []).length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--surface-2)", background: "var(--surface-2)30" }}>
                      <td colSpan={5} style={{ padding: "0.75rem", fontWeight: 700, fontSize: "0.8rem", color: "var(--muted)" }}>
                        ALL TIME TOTALS
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 700 }}>{fmt(data?.totalFareCollected)}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#f59e0b" }}>{fmt(data?.totalCommissionEarned)}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#3b82f6" }}>{fmt(data?.totalDriverPayouts)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            {(data?.totalPages ?? 0) > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: "1.5rem" }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>
                  ← Prev
                </button>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Page {page + 1} / {data?.totalPages}
                </span>
                <button className="btn btn-ghost btn-sm" disabled={page >= (data?.totalPages ?? 1) - 1 || loading} onClick={() => setPage(p => p + 1)}>
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* COMMISSION INFO CARD */}
          <div className="card" style={{ marginBottom: "2rem", padding: "1.25rem", background: "linear-gradient(135deg, #f59e0b10, var(--surface))", border: "1px solid #f59e0b30" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: "1.5rem" }}>ℹ️</div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>How BookCar revenue is calculated</div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.7 }}>
                  Every completed ride fare is split: <strong style={{ color: "#f59e0b" }}>{commissionPct} to BookCar</strong> (platform fee) and <strong style={{ color: "#3b82f6" }}>{driverPct} to the driver</strong>.
                  This is applied automatically by the backend (<code>PaymentStrategy.PLATFORM_COMMISSION = 0.30</code>) and is reflected in every driver's wallet credit.
                  Cash rides are collected by the driver directly — their commission is deducted from wallet earnings on settlement.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
