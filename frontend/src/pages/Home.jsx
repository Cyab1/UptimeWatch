import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Home.css";

const API = import.meta.env.VITE_API_URL;

export default function Home() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    url: "",
    alert_email: "",
    interval: 5,
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  async function fetchMonitors() {
    try {
      const { data } = await axios.get(`${API}/api/monitors`);
      setMonitors(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await axios.post(`${API}/api/monitors`, form);
      setForm({ name: "", url: "", alert_email: "", interval: 5 });
      setShowForm(false);
      fetchMonitors();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add monitor");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this monitor?")) return;
    await axios.delete(`${API}/api/monitors/${id}`);
    fetchMonitors();
  }

  async function handleToggle(id, e) {
    e.stopPropagation();
    await axios.post(`${API}/api/monitors/${id}/toggle`);
    fetchMonitors();
  }

  async function handleCheckNow(id, e) {
    e.stopPropagation();
    await axios.post(`${API}/api/monitors/${id}/check-now`);
    setTimeout(fetchMonitors, 2000);
  }

  const upCount = monitors.filter((m) => m.is_up && m.is_active).length;
  const downCount = monitors.filter((m) => !m.is_up && m.is_active).length;

  return (
    <main className="home">
      {/* ── Hero ── */}
      <div className="home-hero">
        <div className="hero-inner">
          <div>
            <h1 className="hero-title">Website uptime monitoring</h1>
            <p className="hero-sub">
              Monitor your sites every 5 minutes. Get instant email alerts when
              something goes down. Free for SA businesses.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add monitor
          </button>
        </div>

        {monitors.length > 0 && (
          <div className="overview-chips">
            <div className="chip chip-up">
              <span className="chip-dot up" />
              {upCount} up
            </div>
            <div className="chip chip-down">
              <span className="chip-dot down" />
              {downCount} down
            </div>
            <div className="chip">{monitors.length} total monitors</div>
          </div>
        )}
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add monitor</h2>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAdd} className="add-form">
              <label className="form-label">Monitor name</label>
              <input
                name="name"
                className="form-input"
                placeholder="My website"
                value={form.name}
                onChange={handleChange}
                required
              />

              <label className="form-label">URL to monitor</label>
              <input
                name="url"
                className="form-input"
                placeholder="https://yourbusiness.co.za"
                value={form.url}
                onChange={handleChange}
                required
              />

              <label className="form-label">Alert email</label>
              <input
                name="alert_email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.alert_email}
                onChange={handleChange}
              />

              <label className="form-label">Check interval</label>
              <select
                name="interval"
                className="form-input"
                value={form.interval}
                onChange={handleChange}
              >
                <option value={1}>Every 1 minute</option>
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={30}>Every 30 minutes</option>
              </select>

              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={adding}>
                {adding ? "Adding…" : "Add monitor"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Monitors list ── */}
      <div className="monitors-section">
        {loading ? (
          <div className="empty-state">
            <p>Loading monitors…</p>
          </div>
        ) : monitors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>No monitors yet</h3>
            <p>Add your first URL to start monitoring</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Add your first monitor
            </button>
          </div>
        ) : (
          <div className="monitors-grid">
            {monitors.map((m) => (
              <div
                className={`monitor-card ${!m.is_active ? "paused" : m.is_up ? "up" : "down"}`}
                key={m.id}
                onClick={() => navigate(`/monitor/${m.id}`)}
              >
                <div className="monitor-top">
                  <div className="monitor-status-row">
                    <span
                      className={`status-dot ${!m.is_active ? "paused" : m.is_up ? "up" : "down"}`}
                    />
                    <span
                      className={`status-label ${!m.is_active ? "" : m.is_up ? "up" : "down"}`}
                    >
                      {!m.is_active ? "Paused" : m.is_up ? "Up" : "Down"}
                    </span>
                  </div>
                  <div
                    className="monitor-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="action-btn"
                      title="Check now"
                      onClick={(e) => handleCheckNow(m.id, e)}
                    >
                      ↻
                    </button>
                    <button
                      className="action-btn"
                      title={m.is_active ? "Pause" : "Resume"}
                      onClick={(e) => handleToggle(m.id, e)}
                    >
                      {m.is_active ? "⏸" : "▶"}
                    </button>
                    <button
                      className="action-btn danger"
                      title="Delete"
                      onClick={(e) => handleDelete(m.id, e)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <h3 className="monitor-name">{m.name}</h3>
                <p className="monitor-url">
                  {m.url.replace(/^https?:\/\//, "")}
                </p>

                <div className="monitor-stats">
                  <div className="monitor-stat">
                    <span className="stat-val">{m.uptime_24h}%</span>
                    <span className="stat-label">Uptime 24h</span>
                  </div>
                  <div className="monitor-stat">
                    <span className="stat-val">
                      {m.avg_response ? `${m.avg_response}ms` : "—"}
                    </span>
                    <span className="stat-label">Avg response</span>
                  </div>
                  <div className="monitor-stat">
                    <span className="stat-val">{m.interval}m</span>
                    <span className="stat-label">Interval</span>
                  </div>
                </div>

                {m.last_checked && (
                  <p className="monitor-last-check">
                    Last checked{" "}
                    {new Date(m.last_checked).toLocaleString("en-ZA", {
                      timeStyle: "short",
                      dateStyle: "short",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="home-footer">
        <span>
          Powered by <strong>StackWise (Pty) Ltd</strong>
        </span>
        <span className="footer-dot">·</span>
        <a href="mailto:hello@stackwiseza.co.za">hello@stackwiseza.co.za</a>
      </footer>
    </main>
  );
}
