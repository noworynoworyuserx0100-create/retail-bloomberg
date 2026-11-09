import threading
from datetime import datetime, timezone
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2
import pyotp

from . import config, state

# Angel One exchange type mapping used by SmartAPI WebSocket V2.
EXCHANGE_TYPES = {"NSE": 1, "NFO": 2, "BSE": 3, "BFO": 4, "MCX": 5}

class AngelFeed:
    def __init__(self):
        self.smart = None
        self.ws = None
        self.thread = None
        self.lock = threading.Lock()
        self.subscribed = set()
        self.jwt = None
        self.feed_token = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        if not config.credentials_ready():
            state.feed_status.update(connected=False, message="Missing Angel One environment variables")
            return
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        try:
            self.smart = SmartConnect(api_key=config.ANGEL_API_KEY)
            totp = pyotp.TOTP(config.ANGEL_TOTP_SECRET).now()
            session = self.smart.generateSession(
                config.ANGEL_CLIENT_CODE, config.ANGEL_PIN, totp
            )
            if not session or not session.get("status"):
                raise RuntimeError(f"Angel One login failed: {session}")
            data = session["data"]
            self.jwt = data["jwtToken"]
            self.feed_token = self.smart.getfeedToken()
            self.ws = SmartWebSocketV2(
                self.jwt, config.ANGEL_API_KEY,
                config.ANGEL_CLIENT_CODE, self.feed_token,
                max_retry_attempt=10, retry_strategy=1,
                retry_delay=2, retry_multiplier=2, retry_duration=60
            )
            self.ws.on_open = self._on_open
            self.ws.on_data = self._on_data
            self.ws.on_error = self._on_error
            self.ws.on_close = self._on_close
            state.feed_status.update(connected=False, message="Connecting to Angel One")
            self.ws.connect()
        except Exception as exc:
            state.feed_status.update(connected=False, message=f"Authentication/feed error: {exc}")

    def _on_open(self, wsapp):
        state.feed_status.update(connected=True, message="Angel One WebSocket connected")
        # NIFTY 50 and BANKNIFTY index tokens; verify current instrument master before use.
        self.subscribe("NSE", ["99926000", "99926009"], mode=1)

    def subscribe(self, exchange: str, tokens: list[str], mode: int = 1):
        if not self.ws or exchange not in EXCHANGE_TYPES:
            return
        fresh = [str(t) for t in tokens if (exchange, str(t), mode) not in self.subscribed]
        if not fresh:
            return
        # One subscription mode per token is recommended by Angel One.
        self.ws.subscribe(
            "pulse-live", mode,
            [{"exchangeType": EXCHANGE_TYPES[exchange], "tokens": fresh}]
        )
        for token in fresh:
            self.subscribed.add((exchange, token, mode))

    def _on_data(self, wsapp, message):
        # SmartWebSocketV2 SDK parses binary packets into a dictionary.
        try:
            token = str(message.get("token", ""))
            exch_type = int(message.get("exchange_type", 1))
            symbol = f"{exch_type}:{token}"
            # Angel prices are typically supplied in paise; convert to rupees.
            raw_price = message.get("last_traded_price")
            price = (float(raw_price) / 100.0) if raw_price is not None else None
            tick = {
                "symbol": symbol,
                "token": token,
                "exchange_type": exch_type,
                "price": price,
                "raw": message,
                "received_at": datetime.now(timezone.utc).isoformat()
            }
            if price is not None:
                state.feed_status["last_tick"] = tick["received_at"]
                state.publish_tick_from_thread(tick)
        except Exception as exc:
            state.feed_status["message"] = f"Tick parse issue: {exc}"

    def _on_error(self, wsapp, error):
        state.feed_status.update(connected=False, message=f"WebSocket error: {error}")

    def _on_close(self, wsapp):
        state.feed_status.update(connected=False, message="Angel One WebSocket closed")

angel_feed = AngelFeed()
