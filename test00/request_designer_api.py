#!/usr/bin/env python3
"""Request the APN designer API URL and print the response."""

from __future__ import annotations

import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


URL = (
    "https://dev.aipod.now/designer-api?"
    "dispatch=vc_designer_api.p_sku&"
    "comm_product_id=1000013&"
    "ts=1783680096&"
    "nonce=0f46264e9f01915feae6ddfadc5f2432"
)


def main() -> int:
    request = Request(
        URL,
        headers={
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "python-designer-api-request/1.0",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=30) as response:
            body = response.read()
            content_type = response.headers.get("Content-Type", "")

            print(f"Status: {response.status} {response.reason}")
            print(f"Content-Type: {content_type}")
            print()

            text = body.decode("utf-8", errors="replace")
            if "application/json" in content_type.lower():
                print(json.dumps(json.loads(text), indent=2, ensure_ascii=False))
            else:
                print(text)

    except HTTPError as error:
        print(f"HTTP error: {error.code} {error.reason}", file=sys.stderr)
        print(error.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Request failed: {error.reason}", file=sys.stderr)
        return 1
    except TimeoutError:
        print("Request timed out.", file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"Response was not valid JSON: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
