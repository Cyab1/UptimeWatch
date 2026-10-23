import requests
import time
from datetime import datetime, timezone
from models import db, Monitor, CheckResult, Incident
from mailer import send_alert


def check_monitor(app, monitor_id: int):
    with app.app_context():
        monitor = Monitor.query.get(monitor_id)
        if not monitor or not monitor.is_active:
            return

        start = time.time()
        is_up = False
        response_time = None
        status_code = None
        error = None

        try:
            resp = requests.get(
                monitor.url,
                timeout=30,
                headers={"User-Agent": "UptimeWatch/1.0 (StackWise)"},
                allow_redirects=True,
            )
            response_time = round((time.time() - start) * 1000, 2)
            status_code = resp.status_code
            is_up = resp.status_code < 400
        except requests.exceptions.Timeout:
            error = "Request timed out"
        except requests.exceptions.ConnectionError:
            error = "Connection failed"
        except Exception as e:
            error = str(e)[:255]

        # Save check result
        result = CheckResult(
            monitor_id=monitor.id,
            is_up=is_up,
            response_time=response_time,
            status_code=status_code,
            error=error,
            checked_at=datetime.now(timezone.utc),
        )
        db.session.add(result)

        was_up = monitor.is_up
        monitor.is_up = is_up
        monitor.last_checked = datetime.now(timezone.utc)

        # Incident management
        if was_up and not is_up:
            # Site just went down
            incident = Incident(
                monitor_id=monitor.id,
                started_at=datetime.now(timezone.utc),
                cause=error or f"HTTP {status_code}",
            )
            db.session.add(incident)
            db.session.commit()

            # Send down alert
            if monitor.alert_email:
                send_alert(
                    to=monitor.alert_email,
                    subject=f"🔴 {monitor.name} is DOWN",
                    body=(
                        f"UptimeWatch alert — {monitor.name} is unreachable.\n\n"
                        f"URL: {monitor.url}\n"
                        f"Time: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}\n"
                        f"Reason: {error or f'HTTP {status_code}'}\n\n"
                        f"We will notify you when it recovers.\n\n"
                        f"— StackWise UptimeWatch\n"
                        f"hello@stackwiseza.co.za"
                    ),
                )

        elif not was_up and is_up:
            # Site just recovered
            open_incident = (
                Incident.query.filter_by(
                    monitor_id=monitor.id,
                    resolved_at=None,
                )
                .order_by(Incident.started_at.desc())
                .first()
            )

            if open_incident:
                now = datetime.now(timezone.utc)
                open_incident.resolved_at = now
                open_incident.duration = int(
                    (now - open_incident.started_at).total_seconds()
                )

            db.session.commit()

            # Send recovery alert
            if monitor.alert_email:
                send_alert(
                    to=monitor.alert_email,
                    subject=f"🟢 {monitor.name} is back UP",
                    body=(
                        f"UptimeWatch alert — {monitor.name} has recovered.\n\n"
                        f"URL: {monitor.url}\n"
                        f"Time: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}\n"
                        f"Response time: {response_time}ms\n\n"
                        f"— StackWise UptimeWatch\n"
                        f"hello@stackwiseza.co.za"
                    ),
                )
        else:
            db.session.commit()
