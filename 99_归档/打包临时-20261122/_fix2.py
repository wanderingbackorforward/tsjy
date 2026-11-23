import sys
raw=open(sys.argv[1],"rb").read()
if raw[:3]==b"\xef\xbb\xbf":
    has_bom=True
    raw=raw[3:]
else:
    has_bom=False
s=raw.decode("utf-8")
for enc in ["latin-1","cp1252","iso-8859-1","mac_roman"]:
    try:
        fixed=s.encode(enc).decode("utf-8")
        if "\u901a" in fixed or "Platform" in fixed:
            print(f"MATCH with {enc}")
            with open(sys.argv[1],"w",encoding="utf-8") as fh:
                if has_bom: fh.write("\ufeff")
                fh.write(fixed)
            print("FIXED")
            sys.exit(0)
    except: pass
print("NO MATCH")
