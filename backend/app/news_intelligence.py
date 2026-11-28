from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
import re
import xml.etree.ElementTree as ET

import httpx


CACHE_SECONDS = 300
_cache = {}

HEADERS = {"User-Agent": "PulseTerminal/2.0"}

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
    "china", "boj", "bank of japan", "europe",
    "european central bank", "ecb", "crude oil",
    "oil price", "opec", "gold", "dollar", "usd",
    "geopolitical", "war", "tariff", "trade war",
    "sanctions", "global market", "inflation",
    "interest rate", "bond yield", "vix",
    "volatility", "risk sentiment",
]

DOMESTIC_RELEVANCE = [
    "india", "indian", "nifty", "bank nifty",
    "banknifty", "sensex", "nse", "bse", "rbi",
    "reserve bank", "sebi", "government",
    "finance ministry", "budget", "inflation",
    "gdp", "rupee", "fii", "fpi", "dii",
    "earnings", "corporate", "ipo", "policy",
    "tax", "banking", "infrastructure", "india vix",
]

DOMESTIC_STRONG_ANCHORS = [
    "india", "indian", "nifty", "bank nifty",
    "banknifty", "sensex", "nse", "bse",
    "rbi", "reserve bank of india", "sebi",
    "rupee", "inr", "fii", "fpi", "dii",
    "india vix", "national stock exchange",
    "bombay stock exchange",
]

DOMESTIC_COMPANY_ANCHORS = [
    "reliance", "tata", "infosys", "tcs",
    "hdfc", "icici", "sbi", "bharti airtel",
    "adani", "wipro", "larsen", "hindustan unilever",
    "maruti", "bajaj", "kotak", "axis bank",
    "indusind",
]

GLOBAL_IMPACT_TERMS = [
    "federal reserve", "fed rate", "fed decision",
    "treasury yield", "treasury yields",
    "us pce", "pce inflation", "us cpi", "us gdp",
    "wall street", "s&p 500", "nasdaq", "dow jones",
    "china economy", "chinese economy", "boj",
    "bank of japan", "ecb", "european central bank",
    "crude oil", "oil prices", "opec",
    "gold prices", "dollar index", "usd",
    "tariff", "trade war", "sanctions",
    "geopolitical tensions", "geopolitical risk",
    "global markets", "global market selloff",
    "bond yields", "risk aversion", "risk sentiment",
    "war", "conflict",
]

CATALYST_TERMS = {
    "MONETARY_POLICY": [
        "interest rate", "rate cut", "rate hike",
        "federal reserve", "fed", "rbi",
        "monetary policy", "policy rate", "repo rate",
    ],
    "MACRO_DATA": [
        "inflation", "cpi", "ppi", "gdp",
        "employment", "jobs data", "manufacturing",
        "pmi", "economic data",
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
        "bank", "rbi", "credit", "loan",
        "finance", "nbfc", "interest rate",
    ],
    "IT": [
        "software", "technology", "it services",
        "artificial intelligence",
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

POSITIVE_TERMS = [
    "beats estimates", "beat estimates", "profit rises",
    "profit increased", "revenue rises", "revenue increased",
    "record profit", "strong earnings", "strong growth",
    "rate cut", "cuts rates", "lower interest rates",
    "approval granted", "wins order", "order win",
    "contract awarded", "debt reduced", "upgrade",
    "upgraded", "buyback", "dividend announced",
    "bullish", "surges", "rally", "rallies",
    "inflation falls", "inflation eased",
    "positive outlook", "strong demand",
]

NEGATIVE_TERMS = [
    "misses estimates", "missed estimates",
    "profit falls", "profit declined", "profit drops",
    "revenue falls", "revenue declined",
    "loss widens", "weak earnings", "downgrade",
    "downgraded", "default", "fraud", "investigation",
    "penalty", "fine imposed", "ban imposed",
    "rate hike", "raises rates", "higher interest rates",
    "bearish", "crash", "selloff", "sell-off",
    "inflation rises", "inflation surged",
    "negative outlook", "debt crisis",
    "layoffs", "job cuts", "sanctions",
]

AMBIGUOUS_TERMS = [
    "tariff", "trade war", "war", "conflict",
    "geopolitical", "uncertainty", "volatility",
    "mixed signals", "mixed results",
]

SOURCE_TIERS = {
    "tier_1": [
        "reuters", "bloomberg", "associated press",
        "ap news", "financial times", "wall street journal",
        "cnbc", "the economic times",
    ],
    "tier_2": [
        "moneycontrol", "business standard",
        "mint", "livemint", "ndtv", "the hindu",
        "indian express", "economies.com",
    ],
}


def _source_credibility(source):
    name = _clean_text(source)

    if any(
        _clean_text(item) in name
        for item in SOURCE_TIERS["tier_1"]
    ):
        return 10, "HIGH"

    if any(
        _clean_text(item) in name
        for item in SOURCE_TIERS["tier_2"]
    ):
        return 6, "MEDIUM"

    return 2, "LOW"
def _google_news_url(query):
    return (
        "https://news.google.com/rss/search?q="
        f"{quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
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
    text = str(text).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _keyword_matches(text, keywords):
    cleaned = _clean_text(text)
    matched = []

    for keyword in keywords:
        normalized = _clean_text(keyword)

        if not normalized:
            continue

        pattern = (
            r"(?<!\w)"
            + re.escape(normalized)
            + r"(?!\w)"
        )

        if re.search(pattern, cleaned):
            matched.append(keyword)

    return matched


def _classify_market_news(title, source=""):
    cleaned_title = _clean_text(title)
    cleaned_source = _clean_text(source)

    if cleaned_source:
        cleaned_title = re.sub(
            r"\s*-\s*" + re.escape(cleaned_source) + r"$",
            "",
            cleaned_title,
        ).strip()

    india_matches = _keyword_matches(
        cleaned_title,
        DOMESTIC_STRONG_ANCHORS,
    )

    company_matches = _keyword_matches(
        cleaned_title,
        DOMESTIC_COMPANY_ANCHORS,
    )

    global_matches = _keyword_matches(
        cleaned_title,
        GLOBAL_IMPACT_TERMS,
    )

    if india_matches or company_matches:
        return "INDIA"

    if global_matches:
        return "GLOBAL_IMPACT"

    return "IRRELEVANT"


def _relevance_score(title, category):
    keywords = (
        GLOBAL_RELEVANCE
        if category == "global"
        else DOMESTIC_RELEVANCE
    )

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

    score = min(30, total_matches * 10)

    if score >= 20:
        level = "HIGH"
    elif score >= 10:
        level = "MEDIUM"
    else:
        level = "LOW"

    return score, level, matched_categories


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


def _assess_direction(title):
    text = _clean_text(title)

    positive = _keyword_matches(text, POSITIVE_TERMS)
    negative = _keyword_matches(text, NEGATIVE_TERMS)
    ambiguous = _keyword_matches(text, AMBIGUOUS_TERMS)

    if ambiguous:
        direction = "MIXED"
    elif positive and negative:
        direction = "MIXED"
    elif positive:
        direction = "POTENTIALLY_POSITIVE"
    elif negative:
        direction = "POTENTIALLY_NEGATIVE"
    else:
        direction = "UNCLEAR"

    return {
        "impact_direction": direction,
        "positive_evidence": positive,
        "negative_evidence": negative,
        "ambiguity_flags": ambiguous,
        "direction_note": (
            "Headline keyword assessment only. "
            "Not verified causal analysis or a price prediction."
        ),
    }


def _priority_label(score):
    if score >= 75:
        return "TOP PRIORITY"
    elif score >= 55:
        return "HIGH"
    elif score >= 35:
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

        if not title or not link or not published_at:
            continue

        age_seconds = (now - published_at).total_seconds()

        if age_seconds < -21600 or age_seconds > 48 * 3600:
            continue

        classification = _classify_market_news(
            title,
            source,
        )

        if classification == "IRRELEVANT":
            continue

        if (
            category == "domestic"
            and classification == "GLOBAL_IMPACT"
        ):
            continue

        if (
            category == "global"
            and classification == "INDIA"
        ):
            continue

        relevance, relevance_matches = _relevance_score(
            title,
            category,
        )

        catalyst_score, catalyst_level, catalysts = (
            _catalyst_analysis(title)
        )

        recency, age_hours = _recency_score(
            published_at,
            now,
        )

        direction = _assess_direction(title)

        items.append({
            "title": title,
            "link": link,
            "published_at": published_at.isoformat(),
            "age_hours": age_hours,
            "source": source,
            "category": category,
            "market_classification": classification,
            "query": query,
            "relevance_score": relevance,
            "relevance_keywords": relevance_matches,
            "catalyst_score": catalyst_score,
            "catalyst_level": catalyst_level,
            "catalysts": catalysts,
            "recency_score": recency,
            "priority_score": min(
                100,
                relevance + catalyst_score + recency,
            ),
            "priority": "LOW",
            "affected_sectors": _sector_matches(title),
            **direction,
            "_queries": [query],
            "_sources": [source],
        })

    return items


def _deduplicate(articles):
    unique = []

    for article in articles:
        title = _clean_text(article["title"])

        if not title:
            continue

        tokens = set(title.split())
        duplicate_index = None

        for index, existing in enumerate(unique):
            existing_title = _clean_text(
                existing["title"]
            )
            existing_tokens = set(existing_title.split())

            if not tokens or not existing_tokens:
                continue

            similarity = (
                len(tokens & existing_tokens)
                / max(len(tokens | existing_tokens), 1)
            )

            if title == existing_title or similarity >= 0.72:
                duplicate_index = index
                break

        if duplicate_index is None:
            unique.append(article)
            continue

        existing = unique[duplicate_index]

        existing["_queries"] = list(set(
            existing.get("_queries", [])
            + article.get("_queries", [])
        ))

        existing["_sources"] = list(set(
            existing.get("_sources", [])
            + article.get("_sources", [])
        ))

        # Retain the better original headline record.
        if article["priority_score"] > existing["priority_score"]:
            queries = existing["_queries"]
            sources = existing["_sources"]

            unique[duplicate_index] = article

            unique[duplicate_index]["_queries"] = queries
            unique[duplicate_index]["_sources"] = sources

    for article in unique:
        query_count = len(article.get("_queries", []))
        source_count = len(article.get("_sources", []))

        corroboration_score = min(
            10,
            max(0, (source_count - 1) * 5)
            + max(0, (query_count - 1) * 2),
        )

        article["feed_count"] = query_count
        article["publisher_count"] = source_count
        article["corroboration_score"] = corroboration_score

        article["priority_score"] = min(
            100,
            article["relevance_score"]
            + article["catalyst_score"]
            + article["recency_score"]
            + corroboration_score,
        )

        article["priority"] = _priority_label(
            article["priority_score"]
        )

        article["corroboration"] = (
            "MULTIPLE_FEEDS"
            if query_count > 1 or source_count > 1
            else "SINGLE_FEED"
        )

        article.pop("_queries", None)
        article.pop("_sources", None)

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

    result.sort(
        key=lambda item: (
            item["priority_score"],
            item["published_at"],
        ),
        reverse=True,
    )

    payload = {
        "category": category,
        "generated_at": now.isoformat(),
        "source_type": "Google News RSS aggregation",
        "scoring_model": (
            "Relevance 0-40 + catalyst 0-30 "
            "+ recency 0-30 + corroboration 0-10"
        ),
        "article_count": len(result),
        "articles": result,
        "errors": errors,
        "limitations": [
            "News discovery uses Google News RSS.",
            "Scoring and impact assessments are heuristic.",
            "Publisher count is based on RSS publisher labels.",
            "Headline classification may miss article context.",
            "Impact direction is not a price prediction.",
            "RSS availability and timestamps may be delayed.",
        ],
    }

    _cache[category] = {
        "time": now,
        "data": payload,
    }

    return payload
