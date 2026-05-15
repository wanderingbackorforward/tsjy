#!/usr/bin/env bash
set -euo pipefail
cd "/root/shield-monitor-platform-v2/backend"
source .venv/bin/activate
export DATABASE_URL="postgresql://shield_user:shield_pass_123@127.0.0.1:5432/shield_monitor"
export DEFAULT_SECTION_ID="33333333-3333-3333-3333-333333333333"
export CURRENT_RING_NO="336"
uvicorn app.main:app --host 0.0.0.0 --port 8100
