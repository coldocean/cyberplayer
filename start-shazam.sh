#!/bin/bash
# Start shazamio song identification service (free, no API key)
# https://github.com/shazamio/ShazamIO
SHAZAM_PORT=${SHAZAM_PORT:-7331}
pip install shazamio --break-system-packages -q 2>/dev/null || true
echo "[shazam] Starting on port $SHAZAM_PORT..."
python3 "$(dirname "$0")/shazam_service.py" &
