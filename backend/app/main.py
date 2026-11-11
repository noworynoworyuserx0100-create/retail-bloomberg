from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from . import config, state
from .angel import angel_feed


IST = ZoneInfo("Asia/Kolkata")

# These are the same tokens currently used by the live-feed setup.
# Verify them against the latest official Angel One instrument master.
INDEX_INSTRUMENTS = {
    "NIFTY 50": {"exchange": "NSE", "token": "99926000"},
    "BANKNIFTY": {"exchange": "NSE", "token": "99926009"},
}

INTERVAL_LIMITS = {
    "ONE_MINUTE": 30,
    "THREE_MINUTE": 60,
    "FIVE_MINUTE": 100,
    "TEN_MINUTE": 100,
    "FIFTEEN_MINUTE": 200,
    "THIRTY_MINUTE": 200,
    "ONE_HOUR": 400,
    "ONE_DAY": 2000,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.main_loop = asyncio.get_running_loop()
    angel_feed.start()
    yield


app = FastAPI(
    title="Pulse Terminal Market Data API",
    version="0.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True, "service": "pulse-market-api"}


@app.get("/api/v1/market/status")
async def market_status():
    return {
        "feed": state.feed_status,
        "credentials_configured": config.credentials_ready(),
        "latest_symbols": list(state.latest_ticks.keys())
    }


@app.get("/api/v1/market/latest")
async def latest():
    return state.latest_ticks


@app.get("/api/v1/market/candles")
async def historical_candles(
    symbol: str = "NIFTY 50",
    interval: str = "ONE_MINUTE",
    days: int = 5
):
    symbol = symbol.strip().upper()
    interval = interval.strip().upper()

    instrument = INDEX_INSTRUMENTS.get(symbol)

    if instrument is None:
        raise HTTPException(
            status_code=400,
            detail="Supported symbols: NIFTY 50, BANKNIFTY"
        )

    if interval not in INTERVAL_LIMITS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported candle interval"
        )

    if days < 1 or days > INTERVAL_LIMITS[interval]:
        raise HTTPException(
            status_code=400,
            detail=f"Days must be between 1 and {INTERVAL_LIMITS[interval]} for this interval"
        )

    if angel_feed.smart is None:
        raise HTTPException(
            status_code=503,
            detail="Angel One session is not ready"
        )

    now = datetime.now(IST)
    start = now - timedelta(days=days)

    params = {
        "exchange": instrument["exchange"],
        "symboltoken": instrument["token"],
        "interval": interval,
        "fromdate": start.strftime("%Y-%m-%d %H:%M"),
        "todate": now.strftime("%Y-%m-%d %H:%M")
    }

    try:
        response = await run_in_threadpool(
            angel_feed.smart.getCandleData,
            params
        )

        if not response or not response.get("status"):
            raise HTTPException(
                status_code=502,
                detail="Angel One historical candle request failed"
            )

        rows = response.get("data") or []
        candles = []

        for row in rows:
            if not row or len(row) < 6:
                continue

            candle_time = datetime.fromisoformat(
                str(row[0]).replace("Z", "+00:00")
            )

            if candle_time.tzinfo is None:
                candle_time = candle_time.replace(tzinfo=IST)

            candles.append({
                "time": int(candle_time.timestamp()),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5])
            })

        return {
            "symbol": symbol,
            "interval": interval,
            "count": len(candles),
            "candles": candles
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve historical candles from Angel One"
        )


@app.websocket("/ws/market")
async def market_socket(websocket: WebSocket):
    await websocket.accept()
    queue = asyncio.Queue(maxsize=500)
    state.subscribers.add(queue)

    try:
        await websocket.send_json({
            "type": "status",
            "feed": state.feed_status
        })

        for tick in state.latest_ticks.values():
            await websocket.send_json({
                "type": "tick",
                "data": tick
            })

        while True:
            tick = await queue.get()
            await websocket.send_json({
                "type": "tick",
                "data": tick
            })

    except WebSocketDisconnect:
        pass
    finally:
        state.subscribers.discard(queue)


@app.post("/api/v1/market/subscribe")
async def subscribe(payload: dict):
    exchange = str(payload.get("exchange", "NSE")).upper()
    tokens = payload.get("tokens", [])

    if exchange not in {"NSE", "NFO", "BSE", "BFO", "MCX"}:
        raise HTTPException(400, "Unsupported exchange")

    if not isinstance(tokens, list) or not tokens or len(tokens) > 100:
        raise HTTPException(400, "Provide 1-100 instrument tokens")

    angel_feed.subscribe(
        exchange,
        [str(x) for x in tokens],
        mode=1
    )

    return {
        "accepted": True,
        "exchange": exchange,
        "count": len(tokens)
    }


@app.get("/api/v1/instruments/search")
async def search_instruments(q: str):
    return {
        "query": q,
        "results": [],
        "message": "Instrument master not loaded yet"
    }
