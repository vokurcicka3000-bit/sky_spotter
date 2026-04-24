#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Building..."
npm run build
echo "Restarting service..."
launchctl stop com.peterkratochvil.sky-spotter
sleep 1
launchctl start com.peterkratochvil.sky-spotter
echo "Done. Logs: tail -f ~/Library/Logs/sky-spotter.log"
