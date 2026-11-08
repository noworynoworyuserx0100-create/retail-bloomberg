from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import json
import xml.etree.ElementTree as ET
import os
import pyotp
from smartapi import SmartConnect

PORT = int(os.environ.get("PORT", 8000))

API_KEY = os.environ.get("ANGEL_API_KEY", "")
CLIENT_ID = os.environ.get("ANGEL_CLIENT_ID", "")
PIN = os.environ.get("ANGEL_PIN", "")
TOTP_SECRET = os.environ.get("ANGEL_TOTP", "")

smart_connect = None
session_data = None

def init_angel_session():
    global smart_connect, session_data
    if not (API_KEY and CLIENT_ID and PIN):
        print("⚠️ Angel Credentials missing in Environment Variables.")
        return False
    try:
        smart_connect = SmartConnect(api_key=API_KEY)
        totp_code = pyotp.TOTP(TOTP_SECRET).now() if TOTP_SECRET else ""
        data = smart_connect.generateSession(CLIENT_ID, PIN, totp_code)
        if data and data.get('status'):
            session_data = data['data']
            print("🔥 Angel One 0-Latency SmartAPI Connected Successfully!")
            return True
        else:
            print(f"❌ Angel Login Failed: {data}")
    except Exception as e:
        print(f"❌ Angel API Connection Error: {e}")
    return False

init_angel_session()

class LiveMarketHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path.startswith('/api/quote/'):
            symbol = parsed_path.path.replace('/api/quote/', '').upper()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            try:
                if smart_connect and session_data:
                    ltp_res = smart_connect.ltpData("NSE", symbol, "3045") 
                    if ltp_res and ltp_res.get('status') and 'data' in ltp_res:
                        d = ltp_res['data']
                        payload = {
                            "symbol": symbol,
                            "price": d.get('ltp', 0.0),
                            "close": d.get('close', 0.0),
                            "high": d.get('high', 0.0),
                            "low": d.get('low', 0.0),
                            "source": "AngelOne SmartAPI (0-Latency Direct Feed)"
                        }
                        self.wfile.write(json.dumps(payload).encode())
                        return

                init_angel_session()
                self.wfile.write(json.dumps({"error": "Connecting to Angel One SmartAPI..."}).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif parsed_path.path == '/api/news':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                rss_url = "https://news.google.com/rss/search?q=Indian+stock+market+NSE+BSE&hl=en-IN&gl=IN&ceid=IN:en"
                req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    root = ET.fromstring(response.read())
                    news_items = []
                    for item in root.findall('.//item')[:10]:
                        title = item.find('title').text if item.find('title') is not None else ""
                        pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                        link = item.find('link').text if item.find('link') is not None else ""
                        news_items.append({"title": title, "time": pub_date[:16], "link": link})
                    self.wfile.write(json.dumps(news_items).encode())
            except Exception as e:
                self.wfile.write(json.dumps([]).encode())
        else:
            super().do_GET()

server_address = ('', PORT)
httpd = HTTPServer(server_address, LiveMarketHandler)
print(f"🚀 Retail Terminal Angel One Engine Running on Port: {PORT}")
httpd.serve_forever()
