#!/usr/bin/env bash
set -euo pipefail
tmux kill-session -t shield-v2-backend 2>/dev/null || true
tmux kill-session -t shield-v2-frontend 2>/dev/null || true
fuser -k 8100/tcp 2>/dev/null || true
fuser -k 5180/tcp 2>/dev/null || true
tmux new -d -s shield-v2-backend "/root/shield-monitor-platform-v2/scripts/start_backend.sh"
tmux new -d -s shield-v2-frontend "/root/shield-monitor-platform-v2/scripts/start_frontend.sh"
tmux ls
