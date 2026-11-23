import sys
raw=open(sys.argv[1],"rb").read()
if raw[:3]==b"\xef\xbb\xbf":
    has_bom=True
    raw=raw[3:]
else:
    has_bom=False
s=raw.decode("utf-8")
for enc in ["gbk","gb2312","gb18030","big5","shift_jis","euc_kr"]:
    try:
        fixed=s.encode("utf-8").decode(enc)
        if "\u901a" in fixed or "\u6307" in fixed or "Platform" in fixed or "title" in fixed.lower():
            print(f"MATCH with {enc}")
            with open(sys.argv[1],"w",encoding="utf-8") as fh:
                if has_bom: fh.write("\ufeff")
                fh.write(fixed)
            print("FIXED")
            sys.exit(0)
    except: pass
print("NO MATCH")
