import sys
raw=open(sys.argv[1],"rb").read()
if raw[:3]==b"\xef\xbb\xbf": raw=raw[3:]
s=raw.decode("utf-8")
# extract the PLATFORM_TITLE value
idx=s.find("PLATFORM_TITLE")
if idx>=0:
    start=s.find(""",idx)+1
    end=s.find(""",start)
    title=s[start:end]
    print("GARBLED:",repr(title))
    print("HEX:",title.encode("utf-8").hex())
    for enc in ["gbk","gb2312","gb18030"]:
        try:
            decoded=title.encode("utf-8").decode(enc)
            print(f"{enc}: {decoded}")
        except Exception as e:
            print(f"{enc} FAIL: {e}")
