#!/usr/bin/env python3
"""
Backfill lat/lon coordinates for audit logs that have geolocation but no coordinates.

This script fetches coordinates for existing city/region/country data by:
1. Finding unique IPs with geo_location but without lat/lon
2. Looking up coordinates via ip-api.com
3. Updating all logs for each IP with the coordinates
"""

import sqlite3
import json
import time
import requests
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / 'data' / 'planning.db'

def get_geolocation_with_coords(ip_address: str):
    """Get geolocation data including coordinates for an IP address."""
    if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
        return None

    try:
        response = requests.get(
            f'http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,region,regionName,city,timezone,lat,lon',
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return {
                    'country': data.get('country', 'Unknown'),
                    'country_code': data.get('countryCode', 'XX'),
                    'region': data.get('regionName', 'Unknown'),
                    'city': data.get('city', 'Unknown'),
                    'timezone': data.get('timezone', 'Unknown'),
                    'lat': data.get('lat'),
                    'lon': data.get('lon')
                }
    except Exception as e:
        print(f"  Error looking up {ip_address}: {e}")

    return None

def main():
    print("=== Backfilling Geolocation Coordinates ===\n")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Find unique IPs that have geolocation but no lat/lon
    print("Finding IPs without coordinates...")
    cursor.execute('''
        SELECT DISTINCT ip_address, geo_location
        FROM enhanced_audit_log
        WHERE geo_location IS NOT NULL
        AND geo_location NOT LIKE '%lat%'
        AND ip_address IS NOT NULL
        AND ip_address NOT IN ('127.0.0.1', 'localhost', '::1')
    ''')

    ips_to_update = cursor.fetchall()
    print(f"Found {len(ips_to_update)} unique IPs without coordinates\n")

    if len(ips_to_update) == 0:
        print("No IPs need updating. All geolocation data already has coordinates.")
        conn.close()
        return

    updated_count = 0
    failed_count = 0

    for row in ips_to_update:
        ip = row['ip_address']
        old_geo = json.loads(row['geo_location'])

        print(f"Processing {ip} ({old_geo.get('city')}, {old_geo.get('region')})...")

        # Look up coordinates
        new_geo = get_geolocation_with_coords(ip)

        if new_geo and new_geo.get('lat') and new_geo.get('lon'):
            # Merge with existing data (keep cf_country_code if it exists)
            if 'cf_country_code' in old_geo:
                new_geo['cf_country_code'] = old_geo['cf_country_code']

            # Update all logs for this IP
            cursor.execute('''
                UPDATE enhanced_audit_log
                SET geo_location = ?
                WHERE ip_address = ?
                AND (geo_location NOT LIKE '%lat%' OR geo_location IS NULL)
            ''', (json.dumps(new_geo), ip))

            rows_updated = cursor.rowcount
            print(f"  ✓ Updated {rows_updated} log(s) with coordinates: {new_geo['lat']}, {new_geo['lon']}")
            updated_count += 1
        else:
            print(f"  ✗ Failed to get coordinates")
            failed_count += 1

        # Rate limit: ip-api.com free tier allows 45 requests/minute
        time.sleep(1.5)

    # Commit changes
    conn.commit()
    conn.close()

    print(f"\n=== Summary ===")
    print(f"Successfully updated: {updated_count} IPs")
    print(f"Failed: {failed_count} IPs")
    print(f"\nTotal logs updated with coordinates: {updated_count * len(ips_to_update)}")
    print("\nDone!")

if __name__ == '__main__':
    main()
