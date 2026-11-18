
"""
Pulse Terminal - Angel One Instrument Master
Downloads and filters active NIFTY and BANKNIFTY index options.
"""

from datetime import datetime, date
from threading import Lock
import httpx


MASTER_URL = (
    "https://margincalculator.angelone.in/"
    "OpenAPI_File/files/OpenAPIScripMaster.json"
)

CACHE_SECONDS = 6 * 60 * 60

_cache = {
    "instruments": None,
    "loaded_at": None,
}

_lock = Lock()


def _parse_expiry(value):
    """Convert Angel One expiry strings into YYYY-MM-DD."""
    if not value:
        return None

    value = str(value).strip().upper()

    for fmt in ("%d%b%Y", "%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue

    return None


def load_instruments(force_refresh=False):
    """Download and cache the Angel One instrument master."""

    with _lock:
        now = datetime.now()
        loaded_at = _cache["loaded_at"]

        if (
            not force_refresh
            and _cache["instruments"] is not None
            and loaded_at is not None
            and (now - loaded_at).total_seconds() < CACHE_SECONDS
        ):
            return _cache["instruments"]

        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.get(
                    MASTER_URL,
                    headers={"User-Agent": "PulseTerminal/1.0"},
                )
                response.raise_for_status()
                data = response.json()

            if not isinstance(data, list):
                raise ValueError("Instrument master is not a JSON list")

            _cache["instruments"] = data
            _cache["loaded_at"] = now

            return data

        except Exception as exc:
            # Keep previously downloaded data if refresh fails.
            if _cache["instruments"] is not None:
                return _cache["instruments"]

            raise RuntimeError(
                f"Unable to load Angel One instrument master: {exc}"
            ) from exc


def get_option_contracts(underlying, expiry=None):
    """
    Get active NIFTY or BANKNIFTY option contracts.

    underlying: NIFTY or BANKNIFTY
    expiry: optional YYYY-MM-DD expiry date
    """

    underlying = str(underlying).strip().upper()

    allowed = {
        "NIFTY",
        "NIFTY 50",
        "BANKNIFTY",
    }

    if underlying not in allowed:
        raise ValueError(
            "Supported underlyings: NIFTY and BANKNIFTY"
        )

    if underlying == "NIFTY 50":
        underlying = "NIFTY"

    requested_expiry = None

    if expiry:
        try:
            requested_expiry = date.fromisoformat(str(expiry))
        except ValueError as exc:
            raise ValueError(
                "Expiry must use YYYY-MM-DD format"
            ) from exc

    instruments = load_instruments()
    today = datetime.now().date()

    contracts = []

    for item in instruments:
        if not isinstance(item, dict):
            continue

        if str(item.get("exch_seg", "")).upper() != "NFO":
            continue

        if str(item.get("instrumenttype", "")).upper() != "OPTIDX":
            continue

        if str(item.get("name", "")).upper() != underlying:
            continue

        option_type = str(item.get("symbol", "")).upper()

        if option_type.endswith("CE"):
            option_type = "CE"
        elif option_type.endswith("PE"):
            option_type = "PE"
        else:
            continue

        expiry_date = _parse_expiry(item.get("expiry"))

        if not expiry_date or expiry_date < today:
            continue

        if requested_expiry and expiry_date != requested_expiry:
            continue

        try:
            # Angel One index-option strikes are stored in paise.
            strike = float(item.get("strike")) / 100
        except (TypeError, ValueError):
            continue

        if strike <= 0:
            continue

        contracts.append({
            "underlying": underlying,
            "symbol": item.get("symbol"),
            "token": str(item.get("token")),
            "exchange": "NFO",
            "expiry": expiry_date.isoformat(),
            "strike": strike,
            "option_type": option_type,
            "lot_size": int(float(item.get("lotsize", 0))),
            "tick_size": float(item.get("tick_size", 0)) / 100,
        })

    contracts.sort(
        key=lambda x: (
            x["expiry"],
            x["strike"],
            x["option_type"],
        )
    )

    return contracts


def get_available_expiries(underlying):
    """Return sorted available expiry dates."""

    contracts = get_option_contracts(underlying)

    return sorted({
        contract["expiry"]
        for contract in contracts
    })
