#!/usr/bin/env bash
set -euo pipefail
cd "/root/shield-monitor-platform-v2/frontend"
npm run dev -- --host 0.0.0.0 --port 5180 --strictPort
