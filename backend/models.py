from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class Monitor(db.Model):
    __tablename__ = "monitors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(2048), nullable=False)
    interval = db.Column(db.Integer, default=5)  # minutes
    alert_email = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_up = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_checked = db.Column(db.DateTime, nullable=True)

    checks = db.relationship(
        "CheckResult", backref="monitor", lazy=True, cascade="all, delete"
    )
    incidents = db.relationship(
        "Incident", backref="monitor", lazy=True, cascade="all, delete"
    )

    def to_dict(self):
        # Uptime % from last 24h
        from datetime import timedelta
        from sqlalchemy import func

        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        total = CheckResult.query.filter(
            CheckResult.monitor_id == self.id, CheckResult.checked_at >= cutoff
        ).count()
        up = CheckResult.query.filter(
            CheckResult.monitor_id == self.id,
            CheckResult.checked_at >= cutoff,
            CheckResult.is_up == True,
        ).count()
        uptime = round((up / total * 100), 2) if total > 0 else 100.0

        # Avg response time last 24h
        avg_resp = (
            db.session.query(func.avg(CheckResult.response_time))
            .filter(
                CheckResult.monitor_id == self.id,
                CheckResult.checked_at >= cutoff,
                CheckResult.response_time != None,
            )
            .scalar()
        )

        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "interval": self.interval,
            "alert_email": self.alert_email,
            "is_active": self.is_active,
            "is_up": self.is_up,
            "created_at": self.created_at.isoformat(),
            "last_checked": (
                self.last_checked.isoformat() if self.last_checked else None
            ),
            "uptime_24h": uptime,
            "avg_response": round(avg_resp, 0) if avg_resp else None,
        }


class CheckResult(db.Model):
    __tablename__ = "check_results"
    id = db.Column(db.Integer, primary_key=True)
    monitor_id = db.Column(db.Integer, db.ForeignKey("monitors.id"), nullable=False)
    is_up = db.Column(db.Boolean, nullable=False)
    response_time = db.Column(db.Float, nullable=True)  # ms
    status_code = db.Column(db.Integer, nullable=True)
    error = db.Column(db.String(512), nullable=True)
    checked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "monitor_id": self.monitor_id,
            "is_up": self.is_up,
            "response_time": self.response_time,
            "status_code": self.status_code,
            "error": self.error,
            "checked_at": self.checked_at.isoformat(),
        }


class Incident(db.Model):
    __tablename__ = "incidents"
    id = db.Column(db.Integer, primary_key=True)
    monitor_id = db.Column(db.Integer, db.ForeignKey("monitors.id"), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    duration = db.Column(db.Integer, nullable=True)  # seconds
    cause = db.Column(db.String(512), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "monitor_id": self.monitor_id,
            "started_at": self.started_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "duration": self.duration,
            "cause": self.cause,
        }
