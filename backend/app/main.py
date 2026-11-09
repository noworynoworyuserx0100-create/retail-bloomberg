from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config, state
from .angel import angel_feed

@asynccontextmanager
async def lifespan(app: FastAPI):
    state.main_loop = asyncio.get_running_loop()
    angel_feed.start()
    yield

app = FastAPI(title="Pulse Terminal Market Data API", version="0.1.0", lifespan=lifespan)
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

@app.websocket("/ws/market")
async def market_socket(websocket: WebSocket):
    await websocket.accept()
    queue = asyncio.Queue(maxsize=500)
    state.subscribers.add(queue)
    try:
        await websocket.send_json({"type": "status", "feed": state.feed_status})
        # Send most recent values on connect.
        for tick in state.latest_ticks.values():
            await websocket.send_json({"type": "tick", "data": tick})
        while True:
            tick = await queue.get()
            await websocket.send_json({"type": "tick", "data": tick})
    except WebSocketDisconnect:
        pass
    finally:
        state.subscribers.discard(queue)

@app.post("/api/v1/market/subscribe")
async def subscribe(payload: dict):
    # MVP allow-list only. Add symbols after loading and validating the official instrument master.
    exchange = str(payload.get("exchange", "NSE")).upper()
    tokens = payload.get("tokens", [])
    if exchange not in {"NSE", "NFO", "BSE", "BFO", "MCX"}:
        raise HTTPException(400, "Unsupported exchange")
    if not isinstance(tokens, list) or not tokens or len(tokens) > 100:
        raise HTTPException(400, "Provide 1-100 instrument tokens")
    angel_feed.subscribe(exchange, [str(x) for x in tokens], mode=1)
    return {"accepted": True, "exchange": exchange, "count": len(tokens)}

@app.get("/api/v1/instruments/search")
async def search_instruments(q: str):
    # Placeholder until the official Angel One instrument master is downloaded and indexed.
    # This endpoint intentionally does not fabricate a 5,000+ symbol catalogue.
    return {"query": q, "results": [], "message": "Instrument master not loaded yet"}
