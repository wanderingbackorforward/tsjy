#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://127.0.0.1:8100/api/v2}"
ROOT_DIR="${ROOT_DIR:-/root/shield-monitor-platform-v2}"
INCOMING="$ROOT_DIR/incoming"
PROCESSED="$ROOT_DIR/processed"
REJECTED="$ROOT_DIR/rejected"

mkdir -p "$INCOMING" "$PROCESSED" "$REJECTED"

detect_category() {
  name="$1"
  case "$name" in
    *环号*|*里程*|*进度*) echo "ring_mileage" ;;
    *掘进*|*盾构*|*PLC*|*参数*) echo "shield_operation" ;;
    *监测*|*沉降*|*测点*) echo "monitoring_reading" ;;
    *风险源*|*穿越*|*建构筑物*) echo "risk_source" ;;
    *注浆*) echo "grouting" ;;
    *泥水*|*泥浆*) echo "slurry" ;;
    *事件*|*报警*|*异常*) echo "event" ;;
    *) echo "unknown" ;;
  esac
}

shopt -s nullglob
for file in "$INCOMING"/*; do
  base="$(basename "$file")"
  category="$(detect_category "$base")"

  echo "[auto-ingest] file=$base category=$category"

  if [ "$category" = "unknown" ]; then
    echo "[auto-ingest] reject unknown category: $base"
    mv "$file" "$REJECTED/$base"
    continue
  fi

  response="$(curl -sS -X POST "$API_BASE/imports/upload" \
    -F "file=@$file" \
    -F "data_category=$category" || true)"

  echo "$response" > "$file.response.json"

  if echo "$response" | grep -q "batchId"; then
    mv "$file" "$PROCESSED/$base"
    mv "$file.response.json" "$PROCESSED/$base.response.json"
    echo "[auto-ingest] uploaded: $base"
  else
    mv "$file" "$REJECTED/$base"
    mv "$file.response.json" "$REJECTED/$base.response.json"
    echo "[auto-ingest] upload failed: $base"
  fi
done
