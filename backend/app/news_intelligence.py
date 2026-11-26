from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
import re
import xml.etree.ElementTree as ET

import httpx


CACHE_SECONDS = 300
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

GLOBAL_RELEVANCE = [
    "federal reserve", "fed", "treasury yield", "us bond",
    "wall street", "s&p 500", "nasdaq", "dow jones",
    "china", "pbo c", "boj", "bank of japan",
    "europe", "european central bank", "ecb",
    "crude oil", "oil price", "opec", "gold",
    "dollar", "usd", "geopolitical", "war", "tariff",
    "trade war", "sanctions", "global market",
    "inflation", "interest rate", "bond yield",
    "vix", "volatility", "risk sentiment",
]

DOMESTIC_RELEVANCE = [
    "india", "indian", "nifty", "bank nifty", "banknifty",
    "sensex", "nse", "bse", "rbi", "reserve bank",
    "sebi", "government", "finance ministry",
    "budget", "inflation", "gdp", "rupee",
    "fii", "fpi", "dii", "earnings",
    "corporate", "ipo", "policy", "tax",
    "banking", "infrastructure", "india vix",
]

CATALYST_TERMS = {
    "MONETARY_POLICY": [
        "interest rate", "rate cut", "rate hike",
        "federal reserve", "fed", "rbi", "monetary policy",
        "policy rate", "repo rate",
    ],
    "MACRO_DATA": [
        "inflation", "cpi", "ppi", "gdp", "employment",
        "jobs data", "manufacturing", "pmi", "economic data",
    ],
    "GEOPOLITICS": [
        "war", "conflict", "sanctions", "tariff",
        "trade war", "geopolitical", "attack", "ceasefire",
    ],
    "COMMODITIES": [
        "crude oil", "oil price", "opec", "gold",
        "natural gas", "copper",
    ],
    "CORPORATE": [
        "earnings", "results", "profit", "revenue",
        "merger", "acquisition", "order win",
        "guidance", "ipo", "buyback",
    ],
    "REGULATORY": [
        "sebi", "regulation", "regulatory",
        "rbi circular", "policy change", "ban",
        "supreme court", "court ruling",
    ],
    "MARKET_FLOWS": [
        "fii", "fpi", "dii", "institutional",
        "fund flow", "flows", "positioning",
    ],
}

SECTOR_KEYWORDS = {
    "BANKING": [
        "bank", "rbi", "credit", "loan", "finance",
        "nbfc", "interest rate",
    ],
    "IT": [
        "software", "technology", "it services",
        "artificial intelligence", "ai",
    ],
    "ENERGY": [
        "oil", "crude", "gas", "energy", "opec",
    ],
    "AUTO": [
        "auto", "automobile", "vehicle", "ev",
    ],
    "METALS": [
        "steel", "metal", "copper", "aluminium",
        "aluminum", "iron ore",
    ],
    "PHARMA": [
        "pharma", "drug", "medicine", "healthcare",
    ],
    "FMCG": [
        "consumer", "fmcg", "food", "beverage",
    ],
    "INFRA": [
        "infrastructure", "construction", "road",
        "rail", "airport",
    ],
    "REALTY": [
        "real estate", "property", "housing",
    ],
    "TELECOM": [
        "telecom", "mobile network",
    ],
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

        return parsed
    except Exception:
        return None


def _clean_text(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _keyword_matches(text, keywords):
    cleaned = _clean_text(text)
    matched = []

    for keyword in keywords:
        normalized = _clean_text(keyword)

        if normalized and normalized in cleaned:
            matched.append(keyword)

    return matched


def _relevance_score(title, category):
    if category == "global":
        keywords = GLOBAL_RELEVANCE
    else:
        keywords = DOMESTIC_RELEVANCE

    matched = _keyword_matches(title, keywords)

    score = min(40, len(matched) * 8)

    return score, matched


def _catalyst_analysis(title):
    text = _clean_text(title)
    matched_categories = {}
    total_matches = 0

    for catalyst, keywords in CATALYST_TERMS.items():
        matches = _keyword_matches(text, keywords)

        if matches:
            matched_categories[catalyst] = matches
            total_matches += len(matches)

    catalyst_score = min(30, total_matches * 10)

    if catalyst_score >= 20:
        catalyst_level = "HIGH"
    elif catalyst_score >= 10:
        catalyst_level = "MEDIUM"
    else:
        catalyst_level = "LOW"

    return (
        catalyst_score,
        catalyst_level,
        matched_categories,
    )


def _recency_score(published_at, now):
    if not published_at:
        return 0, None

    age_hours = max(
        0,
        (now - published_at).total_seconds() / 3600,
    )

    if age_hours <= 1:
        score = 30
    elif age_hours <= 3:
        score = 25
    elif age_hours <= 6:
        score = 20
    elif age_hours <= 12:
        score = 15
    elif age_hours <= 24:
        score = 10
    elif age_hours <= 48:
        score = 5
    else:
        score = 0

    return score, round(age_hours, 2)


def _sector_matches(title):
    text = _clean_text(title)
    matched = []

    for sector, keywords in SECTOR_KEYWORDS.items():
        if _keyword_matches(text, keywords):
            matched.append(sector)

    return matched


def _priority_label(score):
    if score >= 70:
        return "TOP PRIORITY"
    elif score >= 50:
        return "HIGH"
    elif score >= 30:
        return "MEDIUM"
    return "LOW"


def _parse_feed(xml_text, category, query, now):
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

        published_at = (
            _parse_datetime(date_node.text)
            if date_node is not None and date_node.text
            else None
        )

source = (
            source_node.text.strip()
            if source_node is not None and source_node.text
            else "Google News RSS"
        )       

        # STRICT NEWS FRESHNESS FILTER 
        if not title or not link or not published_at:
            continue

        age_seconds = (now - published_at).total_seconds()

        # Reject future-dated and stale articles.
        if age_seconds < -21600 or age_seconds > 48 * 3600:
            continue

        relevance, relevance_matches = _relevance_score(
            title, category
        )

        catalyst_score, catalyst_level, catalysts = (
            _catalyst_analysis(title)
        )

        recency, age_hours = _recency_score(
            published_at, now
        )

        total_score = min(
            100,
            relevance + catalyst_score + recency,
        )

        items.append({
            "title": title,
            "link": link,
            "published_at": (
                published_at.isoformat()
                if published_at
                else None
            ),
            "age_hours": age_hours,
            "source": source,
            "category": category,
            "query": query,
            "relevance_score": relevance,
            "relevance_keywords": relevance_matches,
            "catalyst_score": catalyst_score,
            "catalyst_level": catalyst_level,
            "catalysts": catalysts,
            "recency_score": recency,
            "priority_score": total_score,
            "priority": _priority_label(total_score),
            "affected_sectors": _sector_matches(title),
            "impact_direction": "UNASSESSED",
            "direction_note": (
                "Priority score measures relevance, catalyst "
                "keywords and recency. It does not predict "
                "price direction."
            ),
        })

    return items


  def _deduplicate(articles):
    unique = []

    for article in articles:
        title = _clean_text(article["title"])

        if not title:
            continue

        title_tokens = set(title.split())
        duplicate_index = None

        for index, existing in enumerate(unique):
            existing_tokens = set(
                _clean_text(existing["title"]).split()
            )

            if not title_tokens or not existing_tokens:
                continue

            overlap = len(
                title_tokens & existing_tokens
            )

            similarity = overlap / max(
                len(title_tokens | existing_tokens), 1
            )

            if title == _clean_text(existing["title"]) or similarity >= 0.72:
                duplicate_index = index
                break

        if duplicate_index is None:
            unique.append(article)
        elif (
            article["priority_score"]
            > unique[duplicate_index]["priority_score"]
        ):
            unique[duplicate_index] = article

    return unique     

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
                            query,
                            now,
                        )
                    )

                except Exception as exc:
                    errors.append({
                        "category": group,
                        "query": query,
                        "error": str(exc),
                    })

    result = _deduplicate(articles)

    # Prioritize the highest scoring stories.
    result.sort(
        key=lambda item: (
            item["priority_score"],
            item["published_at"] or "",
        ),
        reverse=True,
    )

    # Retain a large set for API consumers.
    # UI can later request a top-ranked subset.
    payload = {
        "category": category,
        "generated_at": now.isoformat(),
        "source_type": "Google News RSS aggregation",
        "scoring_model": (
            "Relevance 0-40 + catalyst 0-30 + "
            "recency 0-30"
        ),
        "article_count": len(result),
        "articles": result,
        "errors": errors,
        "limitations": [
            "News discovery currently uses Google News RSS.",
            "Priority scores are rule-based, not predictive.",
            "Headline-only classification may miss article context.",
            "Impact direction has not been independently assessed.",
            "RSS timestamps and availability may be delayed.",
        ],
    }

    _cache[category] = {
        "time": now,
        "data": payload,
    }

    return payload
