#!/usr/bin/env python3
"""
UTM AEROSHIELD — Concurrency Test for POST /api/reservations

Fires N concurrent HTTP requests against the SAME slot.
Expected: exactly 1 success, N-1 conflicts (409).

Usage:
    python concurrency_test.py \
        --url http://localhost:8000 \
        --slot-id 1 \
        --token eyJ... \
        --drone-id 1 \
        --requests 50
"""
import argparse
import asyncio
import httpx
import json
from collections import Counter

async def book_slot(client: httpx.AsyncClient, url: str, token: str, slot_id: int, drone_id: int) -> int:
    try:
        resp = await client.post(
            f"{url}/api/reservations",
            json={"slot_id": slot_id, "drone_id": drone_id, "priority": "STANDARD"},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=30.0
        )
        return resp.status_code
    except Exception as e:
        print(f"Request error: {e}")
        return 0

async def run_test(url: str, token: str, slot_id: int, drone_id: int, n: int):
    print("=" * 48)
    print("UTM AEROSHIELD CONCURRENCY TEST")
    print("=" * 48)
    print(f"Concurrent requests: {n}")
    print(f"Target slot:        {slot_id}")
    print(f"Target drone:       {drone_id}")
    print()

    async with httpx.AsyncClient() as client:
        tasks = [book_slot(client, url, token, slot_id, drone_id) for _ in range(n)]
        results = await asyncio.gather(*tasks)

    counts = Counter(results)
    successes = counts.get(201, 0) + counts.get(200, 0)
    conflicts = counts.get(409, 0)
    others = n - successes - conflicts

    print(f"Successful:         {successes}")
    print(f"Conflicts (409):    {conflicts}")
    print(f"Other errors:       {others}")
    print()

    passed = successes == 1 and conflicts == (n - 1)
    print(f"RESULT: {'PASS' if passed else 'FAIL'}")
    if passed:
        print("Exactly one request acquired the slot. All others received 409 CONFLICT.")
    else:
        print(f"UNEXPECTED: {successes} successes, expected 1.")
        if successes > 1:
            print("CRITICAL: DUPLICATE RESERVATIONS DETECTED — concurrency control FAILED.")
    print("=" * 48)
    return passed

def main():
    parser = argparse.ArgumentParser(description="UTM Concurrency Test")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--slot-id", type=int, required=True, help="Time slot ID to target")
    parser.add_argument("--token", required=True, help="JWT bearer token for auth")
    parser.add_argument("--drone-id", type=int, required=True, help="Drone ID to use for booking")
    parser.add_argument("--requests", type=int, default=50, help="Number of concurrent requests")
    args = parser.parse_args()

    passed = asyncio.run(run_test(args.url, args.token, args.slot_id, args.drone_id, args.requests))
    raise SystemExit(0 if passed else 1)

if __name__ == "__main__":
    main()
