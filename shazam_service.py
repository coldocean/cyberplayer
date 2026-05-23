#!/usr/bin/env python3
"""
Shazam song identification microservice — powered by shazamio
Free, no API key needed, reverse-engineered Shazam API
GitHub: https://github.com/shazamio/ShazamIO (6k+ stars)
"""
import asyncio
import json
import tempfile
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import cgi

from shazamio import Shazam

shazam = Shazam()

def cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")

async def identify_audio(filepath):
    try:
        out = await shazam.recognize(filepath)
        if out and out.get("matches"):
            track = out.get("track", {})
            title = track.get("title", "Unknown")
            subtitle = track.get("subtitle", "Unknown")  # artist
            images = track.get("images", {})
            coverart = images.get("coverart", "")
            genres = track.get("genres", {}).get("primary", "")
            return {
                "found": True,
                "title": title,
                "artist": subtitle,
                "coverart": coverart,
                "genre": genres,
                "raw": track
            }
        return {"found": False}
    except Exception as e:
        return {"found": False, "error": str(e)}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress request logs

    def do_OPTIONS(self):
        self.send_response(200)
        cors_headers(self)
        self.end_headers()

    def do_POST(self):
        if self.path != "/identify":
            self.send_response(404)
            self.end_headers()
            return

        try:
            # Read raw body (audio/webm binary)
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self.send_response(400)
                cors_headers(self)
                self.end_headers()
                self.wfile.write(b'{"error":"no body"}')
                return

            data = self.rfile.read(content_length)

            # Write to temp file
            suffix = ".webm"
            ct = self.headers.get("Content-Type", "")
            if "ogg" in ct: suffix = ".ogg"
            elif "mp4" in ct or "m4a" in ct: suffix = ".mp4"
            elif "wav" in ct: suffix = ".wav"
            elif "mp3" in ct or "mpeg" in ct: suffix = ".mp3"

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                f.write(data)
                tmppath = f.name

            # Run async identify
            loop = asyncio.new_event_loop()
            result = loop.run_until_complete(identify_audio(tmppath))
            loop.close()

            os.unlink(tmppath)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            cors_headers(self)
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            cors_headers(self)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

if __name__ == "__main__":
    port = int(os.environ.get("SHAZAM_PORT", "7331"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"[shazam] listening on :{port}")
    server.serve_forever()
