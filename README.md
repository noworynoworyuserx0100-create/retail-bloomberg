# Pulse Terminal — Angel One Live Market Data MVP

This is a separate FastAPI backend scaffold for your existing Pulse Terminal frontend.
It is **market-data only**: there are no order-placement, modify-order or cancel-order routes.

## Important status
- This is a starter integration scaffold, not a verified live deployment.
- It has not been tested with your Angel One account credentials.
- Verify the current Angel One instrument master and index tokens before relying on subscriptions.
- Angel One API access is subject to its current terms, quotas and exchange permissions.
- Do not expose API key, client code, PIN, TOTP secret, JWT or feed token in frontend code or GitHub.

## Local run
1. Copy `.env.example` to `.env` and fill the four Angel One values locally.
2. `pip install -r requirements.txt`
3. `uvicorn app.main:app --reload --port 8000`
4. Open `http://localhost:8000/health`
5. Check `http://localhost:8000/api/v1/market/status`
6. WebSocket endpoint: `ws://localhost:8000/ws/market`

## Render deployment
Create a separate Render **Web Service** connected to this repository:
- Root Directory: `backend` (if this folder is placed inside the existing repo)
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add `ANGEL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PIN`, `ANGEL_TOTP_SECRET` as secret environment variables.
- Set `ALLOWED_ORIGINS` to the exact frontend origin.

Do not deploy the frontend's existing Static Site settings as the backend service.

## Current MVP limitations
- The websocket SDK callbacks are used for streaming. Tick packet field names and scaling must be validated against live SDK responses before production.
- The two index token values in `app/angel.py` are placeholders to verify against the latest Angel One instrument master.
- The instrument search endpoint is intentionally a placeholder. Next step is to download, validate and index the official Angel One scrip master, then wire exact symbol tokens and exchange types.
- Historical candle API integration and proper OHLC aggregation are next implementation tasks.
- Free Render services may sleep/restart and are not suitable for guaranteed continuous market-hours uptime.
