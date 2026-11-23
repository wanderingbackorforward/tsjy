with open("/root/.gradle/gradle.properties", "r") as f:
    lines = f.readlines()

# Remove proxy lines
lines = [l for l in lines if "proxy" not in l.lower()]

with open("/root/.gradle/gradle.properties", "w") as f:
    f.writelines(lines)

print("PROXY_REMOVED")
print(open("/root/.gradle/gradle.properties").read())