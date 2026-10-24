import os
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from models import db, Monitor, CheckResult, Incident
from monitor import check_monitor
import urllib.parse

app = Flask(__name__)

CORS(
    app,
    origins=[
        "http://localhost:5173",
        "https://uptimewatch.stackwiseza.co.za",
        "https://uptime-watch-*.vercel.app",
        "https://uptime-watch-ruddy.vercel.app",
    ],
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{os.path.join(BASE_DIR, 'uptimewatch.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

# ── Scheduler ─────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler()
scheduler.start()


def schedule_monitor(monitor):
    job_id = f"monitor_{monitor.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    if monitor.is_active:
        scheduler.add_job(
            check_monitor,
            "interval",
            minutes=monitor.interval,
            args=[app, monitor.id],
            id=job_id,
            next_run_time=datetime.now(),
        )


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "UptimeWatch API"}), 200


@app.route("/api/monitors", methods=["GET"])
def get_monitors():
    monitors = Monitor.query.order_by(Monitor.created_at.desc()).all()
    return jsonify([m.to_dict() for m in monitors]), 200


@app.route("/api/monitors", methods=["POST"])
def create_monitor():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    url = (data.get("url") or "").strip()
    email = (data.get("alert_email") or "").strip()
    interval = int(data.get("interval", 5))

    if not name or not url:
        return jsonify({"error": "Name and URL are required"}), 400

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urllib.parse.urlparse(url)
        if not parsed.hostname or "." not in parsed.hostname:
            raise ValueError
    except ValueError:
        return jsonify({"error": "Invalid URL"}), 400

    monitor = Monitor(
        name=name,
        url=url,
        interval=max(1, min(60, interval)),
        alert_email=email or None,
    )
    db.session.add(monitor)
    db.session.commit()
    schedule_monitor(monitor)

    return jsonify(monitor.to_dict()), 201


@app.route("/api/monitors/<int:monitor_id>", methods=["GET"])
def get_monitor(monitor_id):
    monitor = Monitor.query.get_or_404(monitor_id)
    return jsonify(monitor.to_dict()), 200


@app.route("/api/monitors/<int:monitor_id>", methods=["DELETE"])
def delete_monitor(monitor_id):
    monitor = Monitor.query.get_or_404(monitor_id)
    job_id = f"monitor_{monitor.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    db.session.delete(monitor)
    db.session.commit()
    return jsonify({"success": True}), 200


@app.route("/api/monitors/<int:monitor_id>/toggle", methods=["POST"])
def toggle_monitor(monitor_id):
    monitor = Monitor.query.get_or_404(monitor_id)
    monitor.is_active = not monitor.is_active
    db.session.commit()
    schedule_monitor(monitor)
    return jsonify(monitor.to_dict()), 200


@app.route("/api/monitors/<int:monitor_id>/checks", methods=["GET"])
def get_checks(monitor_id):
    hours = request.args.get("hours", 24, type=int)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    checks = (
        CheckResult.query.filter(
            CheckResult.monitor_id == monitor_id,
            CheckResult.checked_at >= cutoff,
        )
        .order_by(CheckResult.checked_at.asc())
        .all()
    )
    return jsonify([c.to_dict() for c in checks]), 200


@app.route("/api/monitors/<int:monitor_id>/incidents", methods=["GET"])
def get_incidents(monitor_id):
    incidents = (
        Incident.query.filter_by(monitor_id=monitor_id)
        .order_by(Incident.started_at.desc())
        .limit(20)
        .all()
    )
    return jsonify([i.to_dict() for i in incidents]), 200


@app.route("/api/monitors/<int:monitor_id>/check-now", methods=["POST"])
def check_now(monitor_id):
    monitor = Monitor.query.get_or_404(monitor_id)
    check_monitor(app, monitor.id)
    return jsonify({"success": True}), 200


# ── Init ──────────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()
    # Schedule all active monitors on startup
    for monitor in Monitor.query.filter_by(is_active=True).all():
        schedule_monitor(monitor)

if __name__ == "__main__":
    app.run(debug=True, port=5001)
