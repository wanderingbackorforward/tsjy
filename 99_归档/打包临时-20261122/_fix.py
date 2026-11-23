#!/usr/bin/env python3
import sys

with open(sys.argv[1], "rb") as fh:
    raw = fh.read()

if raw[:3] == b"\xef\xbb\xbf":
    has_bom = True
    raw = raw[3:]
else:
    has_bom = False

try:
    fixed = raw.decode("utf-8").encode("latin-1").decode("utf-8")
    with open(sys.argv[1], "w", encoding="utf-8") as fh:
        if has_bom:
            fh.write("\ufeff")
        fh.write(fixed)
    print("FIXED")
except Exception as e:
    print(f"SKIP: {e}")
