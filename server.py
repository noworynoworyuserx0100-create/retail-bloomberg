from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import os

PORT = int(os.environ.get("PORT", 8000))

class LiveMarketHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path.startswith('/api/quote/'):
            symbol = parsed_path.path.split('/')[-1]
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            try:
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
                        "low": meta.get('regularMarketDayLow', price)
                    }
                    self.wfile.write(json.dumps(payload).encode())
            except Exception as e:
                error_res = {"error": str(e)}
                self.wfile.write(json.dumps(error_res).encode())
        else:
            super().do_GET()

server_address = ('', PORT)
httpd = HTTPServer(server_address, LiveMarketHandler)
print(f"🚀 Retail Bloomberg Live Server Running on Port: {PORT}")
httpd.serve_forever()
      
