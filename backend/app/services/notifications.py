"""Notification service for EHS-OS: email and SMS alerts."""
import os
import logging

logger = logging.getLogger(__name__)


async def send_incident_notifications(db, tenant_id: str, incident: dict):
    """Send email and SMS notifications to admins/managers when an incident is created."""
    from app.core.config import settings

    if not settings.notification_enabled:
        logger.info("Notifications disabled, skipping")
        return

    # Get all admin and manager users for this tenant
    recipients = await db.fetch(
        """SELECT full_name, email, phone_number, role
           FROM users WHERE tenant_id = $1 AND role IN ('admin', 'manager')""",
        tenant_id,
    )

    severity = incident.get("severity", "low")
    title = incident.get("title", "New Incident")
    location = incident.get("location", "Unknown")
    incident_number = incident.get("incident_number", "")

    # Build notification content
    severity_emoji = {"high": "\U0001f534", "medium": "\U0001f7e1", "low": "\u26aa"}.get(severity, "\u26aa")

    sms_message = f"{severity_emoji} [EHS-OS] {severity.upper()}: {title} at {location}. #{incident_number}"

    email_subject = f"{severity_emoji} New {severity.upper()} Severity Incident - {title}"
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1426; color: #e5e7eb; padding: 24px; border-radius: 12px;">
        <div style="background: {'#dc2626' if severity == 'high' else '#f59e0b' if severity == 'medium' else '#22c55e'}; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 18px;">{severity_emoji} {severity.upper()} Severity Incident</h2>
        </div>
        <table style="width: 100%; border-collapse: collapse; color: #e5e7eb;">
            <tr><td style="padding: 8px 0; color: #9ca3af;">Incident #</td><td style="padding: 8px 0; font-weight: bold;">{incident_number}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Title</td><td style="padding: 8px 0;">{title}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Severity</td><td style="padding: 8px 0; font-weight: bold;">{severity.upper()}</td></tr>
            <tr><td style="padding: 8px 0; color: #9ca3af;">Location</td><td style="padding: 8px 0;">{location}</td></tr>
        </table>
        <div style="margin-top: 20px; text-align: center;">
            <a href="https://ehs-os.netlify.app" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View in EHS-OS</a>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">EHS Operating System - Automated Alert</p>
    </div>
    """

    for recipient in recipients:
        # Send SMS if phone number exists and Twilio configured
        phone = recipient.get("phone_number")
        if phone and settings.twilio_account_sid:
            try:
                await _send_sms(phone, sms_message)
                logger.info(f"SMS sent to {recipient['full_name']} at {phone}")
            except Exception as e:
                logger.error(f"SMS failed for {recipient['full_name']}: {e}")

        # Send email if SendGrid configured
        email = recipient.get("email")
        if email and settings.sendgrid_api_key:
            try:
                await _send_email(email, email_subject, email_body)
                logger.info(f"Email sent to {recipient['full_name']} at {email}")
            except Exception as e:
                logger.error(f"Email failed for {recipient['full_name']}: {e}")


async def _send_sms(to_phone: str, message: str):
    """Send SMS via Twilio."""
    from app.core.config import settings
    import httpx

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            data={
                "To": to_phone,
                "From": settings.twilio_from_phone,
                "Body": message,
            },
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        )
        resp.raise_for_status()


async def _send_email(to_email: str, subject: str, html_body: str):
    """Send email via SendGrid."""
    from app.core.config import settings
    import httpx

    url = "https://api.sendgrid.com/v3/mail/send"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": "alerts@ehs-os.com", "name": "EHS-OS Alerts"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_body}],
            },
        )
        resp.raise_for_status()
