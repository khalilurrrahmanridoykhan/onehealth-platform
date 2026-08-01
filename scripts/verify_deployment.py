#!/usr/bin/env python3
import argparse
import json
import ssl
import urllib.request

parser = argparse.ArgumentParser(description="Verify a deployed OneHealth public boundary")
parser.add_argument("base_url")
args = parser.parse_args()
base = args.base_url.rstrip("/")
if not base.startswith("https://"):
    raise SystemExit("Deployment verification requires HTTPS")
context = ssl.create_default_context()
with urllib.request.urlopen(f"{base}/health", context=context, timeout=10) as response:
    health = json.load(response)
with urllib.request.urlopen(f"{base}/api/v1/ebs/status", context=context, timeout=10) as response:
    status = json.load(response)
print(json.dumps({"health": health, "ebs_status": status}, indent=2))
