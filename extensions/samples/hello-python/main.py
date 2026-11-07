"""Sample Material Tailscale extension in Python.

Reads one JSON request from standard input and writes one JSON answer to standard output.
"""
import json
import sys

request = json.load(sys.stdin)
peer = request.get("peer") or {}
name = peer.get("name") or peer.get("dnsName") or "device"
state = "online" if peer.get("online") else "offline"
json.dump({"ok": True, "message": f"Hello, {name}! It is {state} and runs {peer.get('os') or 'an unknown system'}."}, sys.stdout)
