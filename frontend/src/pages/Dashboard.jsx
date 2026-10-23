import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./Dashboard.css";

const API = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  async function fetchAll() {
    try {
      const [mRes, cRes, iRes] = await Promise.all([
        axios.get(`${API}/api/monitors/${id}`),
        axios.get(`${API}/api/monitors/${id}/checks?hours=${hours}`),
        axios.get(`${API}/api/monitors/${id}/incidents`),
      ]);
      setMonitor(mRes.data);
      setChecks(cRes.data);
      setIncidents(iRes.data);
    } catch (e) {
      if (e.response?.status === 404) navigate("/");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [id, hours]);

  if (loading)
    return (
      <div className="dash-loading">
        <p>Loading dashboard…</p>
      </div>
    );

  if (!monitor) return null;

  // Prepare chart data
  const chartData = checks.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    response: c.response_time,
    status: c.is_up ? 1 : 0,
  }));

  // Uptime bar — last 90 checks
  const bar = checks.slice(-90);

  const gradeColour = monitor.is_up ? "var(--sw-up)" : "var(--sw-down)";

  return (
    <main className="dashboard">
      {/* ── Header ── */}
      <div className="dash-header">
        <div className="container">
          <button className="back-btn" onClick={() => navigate("/")}>
            ← All monitors
          </button>
          <div className="dash-title-row">
            <div>
              <div className="dash-status-row">
                <span
                  className={`status-dot ${monitor.is_up ? "up" : "down"}`}
                />
                <span
                  className={`status-text ${monitor.is_up ? "up" : "down"}`}
                >
                  {monitor.is_active
                    ? monitor.is_up
                      ? "Operational"
                      : "Down"
                    : "Paused"}
                </span>
              </div>
              <h1 className="dash-title">{monitor.name}</h1>
              <a
                href={monitor.url}
                target="_blank"
                rel="noreferrer"
                className="dash-url"
              >
                {monitor.url}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container dash-content">
        {/* ── Stats row ── */}
        <div className="dash-stats">
          {[
            { label: "Uptime 24h", value: `${monitor.uptime_24h}%` },
            {
              label: "Avg response",
              value: monitor.avg_response ? `${monitor.avg_response}ms` : "—",
            },
            { label: "Check interval", value: `${monitor.interval} min` },
            { label: "Total incidents", value: incidents.length },
          ].map((s) => (
            <div className="dash-stat-card" key={s.label}>
              <div className="dash-stat-val" style={{ color: gradeColour }}>
                {s.value}
              </div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Uptime bar ── */}
        <div className="dash-card">
          <div className="card-header">
            <h3 className="card-title">Uptime — last {bar.length} checks</h3>
          </div>
          <div className="uptime-bar">
            {bar.map((c, i) => (
              <div
                key={i}
                className={`uptime-tick ${c.is_up ? "up" : "down"}`}
                title={`${new Date(c.checked_at).toLocaleString("en-ZA")} — ${c.is_up ? "Up" : "Down"} ${c.response_time ? `(${c.response_time}ms)` : ""}`}
              />
            ))}
          </div>
          <div className="uptime-bar-legend">
            <span>Older</span>
            <span>Now</span>
          </div>
        </div>

        {/* ── Response time chart ── */}
        <div className="dash-card">
          <div className="card-header">
            <h3 className="card-title">Response time</h3>
            <div className="hours-toggle">
              {[6, 24, 48].map((h) => (
                <button
                  key={h}
                  className={`hours-btn ${hours === h ? "active" : ""}`}
                  onClick={() => setHours(h)}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <p className="card-empty">
              No data yet — check back after the first ping
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2F1" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip
                  formatter={(val) => [`${val}ms`, "Response time"]}
                  contentStyle={{ fontSize: 13, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="response"
                  stroke="var(--sw-green)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Incidents ── */}
        <div className="dash-card">
          <h3 className="card-title">Incident history</h3>
          {incidents.length === 0 ? (
            <p className="card-empty">🎉 No incidents recorded</p>
          ) : (
            <div className="incidents-list">
              {incidents.map((inc) => (
                <div className="incident-row" key={inc.id}>
                  <div className="incident-status">
                    <span
                      className={`inc-dot ${inc.resolved_at ? "resolved" : "active"}`}
                    />
                    <span className="inc-label">
                      {inc.resolved_at ? "Resolved" : "Ongoing"}
                    </span>
                  </div>
                  <div className="incident-detail">
                    <p className="inc-cause">{inc.cause || "Unknown cause"}</p>
                    <p className="inc-time">
                      {new Date(inc.started_at).toLocaleString("en-ZA", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {inc.duration &&
                        ` · ${Math.round(inc.duration / 60)} min downtime`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Alert config ── */}
        <div className="dash-card">
          <h3 className="card-title">Alert configuration</h3>
          <div className="alert-config">
            <div className="alert-row">
              <span className="alert-label">Email alerts</span>
              <span className="alert-val">
                {monitor.alert_email || (
                  <span className="alert-none">No email set</span>
                )}
              </span>
            </div>
            <div className="alert-row">
              <span className="alert-label">Check interval</span>
              <span className="alert-val">
                Every {monitor.interval} minutes
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer className="dash-footer">
        <p>
          Powered by <strong>StackWise (Pty) Ltd</strong> · UptimeWatch ·
          hello@stackwiseza.co.za
        </p>
      </footer>
    </main>
  );
}
