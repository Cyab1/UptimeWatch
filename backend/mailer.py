import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.zoho.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "hello@stackwiseza.co.za")
SMTP_PASS = os.environ.get("SMTP_PASS", "")


def send_alert(to: str, subject: str, body: str):
    if not SMTP_PASS:
        print(f"[mailer] No SMTP_PASS set — skipping email to {to}")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = f"StackWise UptimeWatch <{SMTP_USER}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        print(f"[mailer] Alert sent to {to}: {subject}")
    except Exception as e:
        print(f"[mailer] Failed to send email: {e}")
