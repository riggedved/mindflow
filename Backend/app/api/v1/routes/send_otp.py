from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from sqlalchemy.future import select
from app.db.sessions import AsyncSessionLocal
from app.modals.user import User
from app.core.security import create_jwt
from app.core.config import settings
import random
import smtplib
from email.mime.text import MIMEText
from email.utils import parseaddr, formataddr
import smtplib
from smtplib import SMTPResponseException, SMTPException, SMTPNotSupportedError

router = APIRouter()

# In-memory OTP store { email: { code: str, expires_at: datetime, attempts: int } }
OTP_TTL_MINUTES = 5
otp_store: dict[str, dict] = {}


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


def _send_email_smtp(to_email: str, subject: str, body: str):
    """Send an email using SMTP if configured; otherwise, log to console for dev.

    Notes:
    -Some providers (e.g., Resend over implicit TLS on port 465) expect SSL from the start
    - If STARTTLS is not supported, we skip it gracefully instead of raising.
    - We normalize the From header to avoid header parsing issues.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
        print("[DEV] OTP email:", to_email, subject, body)
        return

    # Normalize From header (supports values like "Name <email@domain>")
    name, addr = parseaddr(settings.SMTP_FROM)
    from_header = formataddr((name, addr)) if addr else settings.SMTP_FROM

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = from_header
    msg['To'] = to_email

    # Determine envelope sender: prefer explicit config, then header addr, then SMTP user
    envelope_from = settings.SMTP_ENVELOPE_FROM or (addr if addr else settings.SMTP_USER)

    debug = getattr(settings, 'SMTP_DEBUG', False)

    # Establish connection and negotiate TLS/auth
    if int(settings.SMTP_PORT) == 465:
        # Implicit TLS
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if debug:
                server.set_debuglevel(1)
            if debug:
                print('[SMTP] Connected via SSL to', settings.SMTP_HOST, settings.SMTP_PORT)
            server.ehlo()
            try:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            except SMTPResponseException as e:
                if debug:
                    print('[SMTP] LOGIN exception (SSL):', e.smtp_code, e.smtp_error)
                # Some servers misreport success with 250; accept and continue
                if e.smtp_code != 250:
                    raise
            result = server.sendmail(envelope_from, [to_email], msg.as_string())
            if debug:
                print('[SMTP] sendmail result (SSL):', result)
    else:
        # Plain connection upgraded to TLS if supported (typical for 587/2525)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if debug:
                server.set_debuglevel(1)
            if debug:
                print('[SMTP] Connected (plain) to', settings.SMTP_HOST, settings.SMTP_PORT)
            # Say hello so the server advertises capabilities (incl. STARTTLS)
            server.ehlo()
            try:
                server.starttls()
                server.ehlo()  # Re-announce after TLS per SMTP best practice
            except (SMTPNotSupportedError, SMTPException) as e:
                # Some servers return unexpected codes (e.g., 250 OK) on STARTTLS; allow fallback
                code = getattr(e, 'smtp_code', None)
                if debug:
                    print('[SMTP] STARTTLS exception, code:', code, 'msg:', getattr(e, 'smtp_error', e))
                if code not in (250, 454, None):
                    # For non-benign responses re-raise
                    raise
            # Authenticate and send
            try:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            except SMTPResponseException as e:
                if debug:
                    print('[SMTP] LOGIN exception:', e.smtp_code, e.smtp_error)
                # Accept 250 OK as pseudo-success
                if e.smtp_code != 250:
                    raise
            result = server.sendmail(envelope_from, [to_email], msg.as_string())
            if debug:
                print('[SMTP] sendmail result:', result)


@router.post('/send-otp')
async def send_otp(payload: SendOtpRequest):
    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)
    otp_store[payload.email.lower()] = {"code": code, "expires_at": expires_at, "attempts": 0}

    subject = "Your MindFlow Sign-in Code"
    body = (
        f"Your one-time code is: {code}\n\n"
        f"It expires in {OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email."
    )
    try:
        _send_email_smtp(payload.email, subject, body)
    except Exception as e:
        print("Failed to send OTP email:", e)

    return {"message": "OTP sent"}


@router.post('/verify-otp')
async def verify_otp(payload: VerifyOtpRequest):
    record = otp_store.get(payload.email.lower())
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email")
    record["attempts"] += 1
    if record["attempts"] > 10:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code")
    if datetime.utcnow() > record["expires_at"]:
        del otp_store[payload.email.lower()]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new code")
    if record["code"] != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid code")

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == payload.email.lower()))
        user = res.scalar_one_or_none()
        if not user:
            user = User(email=payload.email.lower(), name=None, avatar=None)
            session.add(user)
            await session.commit()
            await session.refresh(user)

        jwt_token = create_jwt({"sub": str(user.id), "email": user.email})

    del otp_store[payload.email.lower()]

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "avatar": user.avatar},
    }
