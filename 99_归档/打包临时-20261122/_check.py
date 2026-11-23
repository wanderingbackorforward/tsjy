import sys
raw=open(sys.argv[1],"rb").read()
if raw[:3]==b"\xef\xbb\xbf": raw=raw[3:]
s=raw.decode("utf-8")
print(repr(s[:80]))
print("---")
print(repr(s[260:320]))
print("---")
for i,ch in enumerate(s[260:320]):
    if ord(ch)>127: print(f"pos={260+i} char=U+{ord(ch):04X}")
