from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import xml.etree.ElementTree as ET
import os
import pyotp
from smartapi import SmartConnect

PORT = int(os.environ.get("PORT", 8000))

# Angel One Credentials (Render environment variables nundi automatically theeskuntundi)
API_KEY = os.environ.get("ANGEL_API_KEY", "")
CLIENT_ID = os.environ.get("ANGEL_CLIENT_ID", "")
PIN = os.environ.get("ANGEL_PIN", "")
TOTP_SECRET = os.environ.get("ANGEL_TOTP", "")

smartApi = SmartConnect(api_key=API_KEY)
session_data = None

def get_angel_session():
    global session_data
    if not API_KEY or not CLIENT_ID or not PIN:
        print("⚠️ Angel One Credentials not configured in environment variables.")
        return False
    try:
        totp = pyotp.TOTP(TOTP_SECRET).now() if TOTP_SECRET else ""
        data = smartApi.generateSession(CLIENT_ID, PIN, totp)
        if data and data.get('status'):
            session_data = data['data']
            print("🔥 Angel One Session Generated Successfully!")
            return True
    except Exception as e:
        print(f"Angel Login Error: {e}")
    return False

# Try initial connection
get_angel_session()

class LiveMarketHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # 1. Dynamic Stock Search Endpoint
        if parsed_path.path.startswith('/api/search/'):
            query = parsed_path.path.replace('/api/search/', '')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(query)}&quotesCount=10&newsCount=0"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    data = json.loads(response.read().decode())
                    results = [
                        {"symbol": q['symbol'], "name": q.get('shortname', q['symbol']), "exchange": q.get('exchDisp', '')}
                        for q in data.get('quotes', []) if 'symbol' in q
                    ]
                    self.wfile.write(json.dumps(results).encode())
            except Exception as e:
                self.wfile.write(json.dumps([]).encode())

        # 2. Live Quote Endpoint (Angel One or Yahoo Fallback)
        elif parsed_path.path.startswith('/api/quote/'):
            symbol = parsed_path.path.replace('/api/quote/', '')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            try:
                price, high, low, volume = 0, 0, 0, 0
                
                # Try fetching from Angel One if session active, else fallback to Yahoo finance live chart
                if session_data:
                    try:
                        # Example token mapping or direct LTP fetch
                        ltp_res = smartApi.ltpData("NSE", symbol.replace('.NS',''), "2885") # Default token mapping example
                        if ltp_res and 'data' in ltp_res:
                            price = ltp_res['data'].get('ltp', 0)
                    except:
                        pass
                
                # Fallback to Yahoo Finance real-time chart feed if Angel token not mapped yet
                if price == 0:
                    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d"
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        data = json.loads(response.read().decode())
                        meta = data['chart']['result'][0]['meta']
                        price = meta.get('regularMarketPrice', 0)
                        prev_close = meta.get('chartPreviousClose', price)
                        change = round(price - prev_close, 2)
                        pct_change = round((change / prev_close) * 100, 2) if prev_close else 0.0
                        
                        payload = {
                            "symbol": symbol.upper(),
                            "price": price,
                            "change": change,
                            "pctChange": pct_change,
                            "high": meta.get('regularMarketDayHigh', price),
                            "low": meta.get('regularMarketDayLow', price),
                            "volume": meta.get('regularMarketVolume', 0),
                            "currency": meta.get('currency', 'INR')
                        }
                        self.wfile.write(json.dumps(payload).encode())
                        return

                payload = {
                    "symbol": symbol.upper(),
                    "price": price,
                    "change": 0.0,
                    "pctChange": 0.0,
                    "high": high if high else price,
                    "low": low if low else price,
                    "volume": volume,
                    "currency": "INR"
                }
                self.wfile.write(json.dumps(payload).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        # 3. Live News Scraper
        elif parsed_path.path == '/api/news':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                rss_url = "https://news.google.com/rss/search?q=Indian+stock+market+NSE+BSE&hl=en-IN&gl=IN&ceid=IN:en"
                req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    xml_data = response.read()
                    root = ET.fromstring(xml_data)
                    news_items = []
                    for item in root.findall('.//item')[:10]:
                        title = item.find('title').text if item.find('title') is not None else ""
                        pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                        link = item.find('link').text if item.find('link') is not None else ""
                        sentiment = "BULLISH (+7.0)" if any(w in title.lower() for w in ['rise', 'surge', 'jump', 'gain', 'buy', 'profit', 'high']) else \
                                    "BEARISH (-6.5)" if any(w in title.lower() for w in ['fall', 'drop', 'plunge', 'loss', 'sell', 'down', 'slip']) else "NEUTRAL (0.0)"
                        news_items.append({"title": title, "time": pub_date[:16] if len(pub_date) > 16 else pub_date, "tag": sentiment, "link": link})
                    self.wfile.write(json.dumps(news_items).encode())
            except Exception as e:
                self.wfile.write(json.dumps([]).encode())
        else:
            super().do_GET()

server_address = ('', PORT)
httpd = HTTPServer(server_address, LiveMarketHandler)
print(f"🚀 Retail Bloomberg Engine Running on Port: {PORT}")
httpd.serve_forever()
                        
