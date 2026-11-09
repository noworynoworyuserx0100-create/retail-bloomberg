import asyncio
from collections import defaultdict
from typing import Any

latest_ticks: dict[str, dict[str, Any]] = {}
subscribers: set[asyncio.Queue] = set()
feed_status = {"connected": False, "message": "Not authenticated", "last_tick": None}
main_loop: asyncio.AbstractEventLoop | None = None

def publish_tick_from_thread(tick: dict):
    if main_loop is None:
        return
    def _publish():
        latest_ticks[tick["symbol"]] = tick
        for q in list(subscribers):
            try:
                q.put_nowait(tick)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(tick)
                except Exception:
                    pass
    main_loop.call_soon_threadsafe(_publish)
