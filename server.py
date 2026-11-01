import http.server, urllib.request, urllib.parse, urllib.error

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/proxy?"):
            self.proxy()
        else:
            super().do_GET()

    def proxy(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        url = query.get("url", [""])[0]
        if not url.startswith(("http://", "https://")):
            self.send_error(400, "url must start with http:// or https://")
            return
        req = urllib.request.Request(url, headers={"User-Agent": "EarthJukebox/1.0"})
        # Pass the Range header so the video can seek and stream.
        if self.headers.get("Range"):
            req.add_header("Range", self.headers["Range"])
        try:
            resp = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e:
            resp = e                      # still forward the error status
        except Exception as e:
            self.send_error(502, str(e))
            return
        self.send_response(resp.getcode())
        for h in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
            if resp.headers.get(h):
                self.send_header(h, resp.headers[h])
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass                          # browser closed the connection (normal when seeking)

if __name__ == "__main__":
    print("Open http://localhost:%d  (Ctrl+C to stop)" % PORT)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
