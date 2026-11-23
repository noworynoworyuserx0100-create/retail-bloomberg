from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from . import config, state
from .angel import angel_feed
from .instrument_master import (
    get_available_expiries,
    get_option_contracts,
)


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
    allow_methods=["*"],
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
    mode = int(payload.get("mode", 1))

    if exchange not in {"NSE", "NFO", "BSE", "BFO", "MCX"}:
        raise HTTPException(400, "Unsupported exchange")

    if not isinstance(tokens, list) or not tokens or len(tokens) > 100:
        raise HTTPException(400, "Provide 1-100 instrument tokens")

    if mode not in {1, 2, 3}:
        raise HTTPException(400, "Mode must be 1, 2 or 3")

    angel_feed.subscribe(
        exchange,
        [str(x) for x in tokens],
        mode=mode
    )

    return {
        "accepted": True,
        "exchange": exchange,
        "mode": mode,
        "count": len(tokens)
    }



@app.get("/api/v1/instruments/search")
async def search_instruments(q: str):
    return {
        "query": q,
        "results": [],
        "message": "Instrument master not loaded yet"
    }
@app.get("/api/v1/options/expiries")
async def option_expiries(underlying: str = "NIFTY"):
    try:
        expiries = await run_in_threadpool(
            get_available_expiries,
            underlying
        )

        return {
            "underlying": underlying.upper(),
            "count": len(expiries),
            "expiries": expiries
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to load option expiries"
        )


@app.get("/api/v1/options/contracts")
async def option_contracts(
    underlying: str = "NIFTY",
    expiry: str = None
):
    try:
        contracts = await run_in_threadpool(
            get_option_contracts,
            underlying,
            expiry
        )

        return {
            "underlying": underlying.upper(),
            "expiry": expiry,
            "count": len(contracts),
            "contracts": contracts
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to load option contracts"
    )
    
@app.get("/api/v1/options/quotes")
async def option_quotes(tokens: str):
    token_list = [
        token.strip()
        for token in tokens.split(",")
        if token.strip()
    ]

    if not token_list or len(token_list) > 100:
        raise HTTPException(
            status_code=400,
            detail="Provide 1-100 option tokens"
        )

    quotes = []

    for token in token_list:
        symbol = f"2:{token}"
        tick = state.latest_ticks.get(symbol)

        if not tick:
            quotes.append({
                "token": token,
                "available": False,
                "message": "Waiting for live subscription"
            })
            continue

        raw = tick.get("raw") or {}

        quotes.append({
            "token": token,
            "available": True,
            "ltp": tick.get("price"),
            "volume": raw.get("volume_trade_for_the_day"),
            "oi": raw.get("open_interest"),
            "buy_quantity": raw.get("total_buy_quantity"),
            "sell_quantity": raw.get("total_sell_quantity"),
            "received_at": tick.get("received_at")
        })

    return {
        "exchange": "NFO",
        "count": len(quotes),
        "quotes": quotes
    }
    
@app.get("/api/v1/options/greeks")
async def option_greeks(
    underlying: str = "NIFTY",
    expiry: str = None
):
    underlying = underlying.strip().upper()

    if underlying not in {"NIFTY", "BANKNIFTY"}:
        raise HTTPException(
            status_code=400,
            detail="Supported underlyings: NIFTY, BANKNIFTY"
        )

    if not expiry:
        raise HTTPException(
            status_code=400,
            detail="Expiry is required in YYYY-MM-DD format"
        )

    try:
        expiry_date = datetime.strptime(expiry, "%Y-%m-%d")
        angel_expiry = expiry_date.strftime("%d%b%Y").upper()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expiry. Use YYYY-MM-DD format"
        )

    if angel_feed.smart is None:
        raise HTTPException(
            status_code=503,
            detail="Angel One session is not ready"
        )

    params = {
        "name": underlying,
        "expirydate": angel_expiry
    }

    try:
        response = await run_in_threadpool(
            angel_feed.smart.optionGreek,
            params
        )

        if not response or not response.get("status"):
            raise HTTPException(
                status_code=502,
                detail="Angel One Greeks request failed"
            )

        rows = response.get("data") or []
        greeks = []

        for row in rows:
            try:
                greeks.append({
                    "underlying": row.get("name"),
                    "expiry": row.get("expiry"),
                    "strike": float(row["strikePrice"]),
                    "option_type": row.get("optionType"),
                    "delta": float(row["delta"]),
                    "gamma": float(row["gamma"]),
                    "theta": float(row["theta"]),
                    "vega": float(row["vega"]),
                    "iv": float(row["impliedVolatility"]),
                    "trade_volume": float(row["tradeVolume"])
                })
            except (KeyError, TypeError, ValueError):
                continue

        greeks.sort(
            key=lambda item: (
                item["strike"],
                item["option_type"] or ""
            )
        )
        ce_count = sum(
            1 for item in greeks
            if item["option_type"] == "CE"
        )

        pe_count = sum(
            1 for item in greeks
            if item["option_type"] == "PE"
        )
        return {
            "underlying": underlying,
            "expiry": expiry,
            "angel_expiry": angel_expiry,
            "count": len(greeks),
"ce_count": ce_count,
"pe_count": pe_count,
"greeks": greeks
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve option Greeks from Angel One"
        )

