#!/usr/bin/env python3
import argparse
import getpass
import json
import secrets

from onehealth.auth import ROLE_LEVEL, password_hash

parser = argparse.ArgumentParser(description="Create a hashed OneHealth user configuration entry")
parser.add_argument("username")
parser.add_argument("--role", choices=ROLE_LEVEL, default="viewer")
args = parser.parse_args()
password = getpass.getpass("Password: ")
confirmation = getpass.getpass("Confirm password: ")
if password != confirmation or len(password) < 12:
    raise SystemExit("Passwords must match and contain at least 12 characters")
salt = secrets.token_hex(16)
print(json.dumps({"username": args.username, "role": args.role, "salt": salt, "password_hash": password_hash(password, salt)}))
