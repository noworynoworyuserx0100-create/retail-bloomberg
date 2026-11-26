from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
import xml.etree.ElementTree as ET

import httpx


CACHE_SECONDS = 600
_cache = {}
HEADERS = {
    "User-Agent": "PulseTerminal/1.0 (Market Intelligence)"
}

FEED_QUERIES = {
    "global": [
        "US stock market Federal Reserve Treasury yields",
        "global markets geopolitics trade tariffs",
        "crude oil OPEC gold dollar global economy",
        "Asian markets China economy",
    ],
    "domestic": [
        "India stock market RBI SEBI government economy",
        "India corporate earnings orders mergers NSE BSE",
        "India inflation GDP economic policy",
        "India banking finance infrastructure companies news",
    ],
}

HIGH_IMPACT_KEYWORDS = [
    "war", "sanctions", "tariff", "fed", "federal reserve",
    "interest rate", "rate cut", "rate hike", "inflation",
    "rbi", "sebi", "budget", "tax", "election",
    "crude oil", "opec", "default", "crisis",
    "earnings", "results", "merger", "acquisition",
    "fraud", "ban", "policy", "regulation",
]

MEDIUM_IMPACT_KEYWORDS = [
    "growth", "export", "import", "bank", "bond",
    "liquidity", "trade", "investment", "order",
    "revenue", "profit", "forecast", "guidance",
    "commodity", "currency", "rupee", "yield",
]

SECTOR_KEYWORDS = {
    "BANKING": ["bank", "rbi", "credit", "loan", "finance"],
    "IT": ["software", "technology", "it services", "ai"],
    "ENERGY": ["oil", "crude", "gas", "energy", "opec"],
    "AUTO": ["auto", "automobile", "vehicle", "ev"],
    "METALS": ["steel", "metal", "copper", "aluminium"],
    "PHARMA": ["pharma", "drug", "medicine", "healthcare"],
    "FMCG": ["consumer", "fmcg", "food", "beverage"],
    "INFRA": ["infrastructure", "construction", "road", "rail"],
}


def _google_news_url(query):
    encoded = quote(query)
    return (
        "https://news.google.com/rss/search?q="
        f"{encoded}&hl=en-IN&gl=IN&ceid=IN:en"
    )


def _parse_datetime(value):
    if not value:
        return None

    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()
    except Exception:
        return None


def _impact(headline):
    text = headline.lower()

    high_matches = [
        word for word in HIGH_IMPACT_KEYWORDS
        if word in text
    ]

    medium_matches = [
        word for word in MEDIUM_IMPACT_KEYWORDS
        if word in text
    ]

    if high_matches:
        return "HIGH", high_matches

    if medium_matches:
        return "MEDIUM", medium_matches

    return "LOW", []


def _sectors(headline):
    text = headline.lower()
    matched = []

    for sector, keywords in SECTOR_KEYWORDS.items():
        if any(word in text for word in keywords):
            matched.append(sector)

    return matched


def _parse_feed(xml_text, category, query):
    root = ET.fromstring(xml_text)
    items = []

    for item in root.findall(".//item"):
        title_node = item.find("title")
        link_node = item.find("link")
        date_node = item.find("pubDate")
        source_node = item.find("source")

        title = (
            title_node.text.strip()
            if title_node is not None and title_node.text
            else ""
        )

        link = (
            link_node.text.strip()
            if link_node is not None and link_node.text
            else ""
        )

        published = (
            _parse_datetime(date_node.text)
            if date_node is not None and date_node.text
            else None
        )

        source = (
            source_node.text.strip()
            if source_node is not None and source_node.text
            else "Google News RSS"
        )

        if not title or not link:
            continue

        impact, matched_keywords = _impact(title)

        items.append({
            "title": title,
            "link": link,
            "published_at": published,
            "source": source,
            "category": category,
            "query": query,
            "impact": impact,
            "impact_keywords": matched_keywords,
            "affected_sectors": _sectors(title),
            "impact_direction": "UNASSESSED",
            "direction_note": (
                "Headline-based classification only. "
                "Directional impact requires further analysis."
            ),
        })

    return items


def get_premarket_news(category="all"):
    category = str(category).lower().strip()

    if category not in {"all", "global", "domestic"}:
        raise ValueError(
            "Supported categories: all, global, domestic"
        )

    now = datetime.now(timezone.utc)
    cached = _cache.get(category)

    if cached:
        age = (now - cached["time"]).total_seconds()
        if age < CACHE_SECONDS:
            return cached["data"]

    selected = (
        ["global", "domestic"]
        if category == "all"
        else [category]
    )

    articles = []
    errors = []

    with httpx.Client(
        timeout=12.0,
        headers=HEADERS,
        follow_redirects=True,
    ) as client:

        for group in selected:
            for query in FEED_QUERIES[group]:
                try:
                    response = client.get(
                        _google_news_url(query)
                    )
                    response.raise_for_status()

                    articles.extend(
                        _parse_feed(
                            response.text,
                            group,
                            query
                        )
                    )

                except Exception as exc:
                    errors.append({
                        "category": group,
                        "query": query,
                        "error": str(exc),
                    })

    # Deduplicate similar exact headlines.
    unique = {}
    for article in articles:
        key = article["title"].strip().lower()
        if key not in unique:
            unique[key] = article

    result = list(unique.values())

    result.sort(
        key=lambda item: (
            {"HIGH": 0, "MEDIUM": 1, "LOW": 2}.get(
                item["impact"], 3
            ),
            item["published_at"] or "",
        ),
        reverse=False,
    )

    # Recent stories should generally be presented first.
    result.sort(
        key=lambda item: item["published_at"] or "",
        reverse=True,
    )

    payload = {
        "category": category,
        "generated_at": now.isoformat(),
        "source_type": "Google News RSS aggregation",
        "article_count": len(result),
        "articles": result,
        "errors": errors,
        "limitations": [
            "RSS aggregation is not a licensed institutional news feed.",
            "Headline impact classification is heuristic.",
            "Impact direction has not been independently assessed.",
            "Source timestamps may be missing or delayed.",
        ],
    }

    _cache[category] = {
        "time": now,
        "data": payload,
    }

    return payload
