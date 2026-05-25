#!/bin/bash
# Deploy to Vercel and alias ALL domains
# Set VERCEL_TOKEN env var before running

if [ -z "$VERCEL_TOKEN" ]; then
  echo "ERROR: Set VERCEL_TOKEN env var first"
  exit 1
fi

# Deploy
OUTPUT=$(npx vercel --prod --token $VERCEL_TOKEN --yes 2>&1)
echo "$OUTPUT"

# Extract deployment URL
DEPLOY_URL=$(echo "$OUTPUT" | grep "▲ Production" | head -1 | awk '{print $NF}' | sed 's|https://||')
echo "Deployment URL: $DEPLOY_URL"

if [ -z "$DEPLOY_URL" ]; then
  echo "ERROR: Could not extract deployment URL"
  exit 1
fi

# Alias ALL domains
DOMAINS=(
  "demon.digitalslayer.com"
  "deemah.digitalslayer.com"
  "player.digitalslayer.com"
  "robbmobb.digitalslayer.com"
  "disappoint.digitalslayer.com"
  "rastix.play.digitalslayer.com"
  "digitalslayer.com"
)

for DOMAIN in "${DOMAINS[@]}"; do
  npx vercel alias set "$DEPLOY_URL" "$DOMAIN" --token $VERCEL_TOKEN 2>&1 &
done
wait

echo "All domains aliased!"
