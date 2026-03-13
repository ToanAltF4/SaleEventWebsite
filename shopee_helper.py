#!/usr/bin/env python3
"""Helper script to call Shopee Custom Link API using curl_cffi (Chrome TLS impersonation)."""
import sys
import json
try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    import curl_cffi
    cffi_requests = curl_cffi.requests

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        cookie = input_data["cookie"]
        payload = input_data["payload"]

        headers = {
            "content-type": "application/json; charset=UTF-8",
            "affiliate-program-type": "1",
            "x-sz-sdk-version": "1.12.21",
            "cookie": cookie,
        }

        resp = cffi_requests.post(
            "https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink",
            data=json.dumps(payload),
            headers=headers,
            timeout=15,
            impersonate="chrome",
        )
        print(json.dumps(resp.json()))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
