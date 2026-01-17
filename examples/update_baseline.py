import json
import urllib.request
import urllib.error
import sys

# Configuration
API_URL = "http://127.0.0.1:5137/api/profile/Baseline"

# 1. Define the Data
# ------------------

# Active Holdings (Ending Balance > 0)
# This is what drives the 'Assets' table and calculations
investment_types = [
    {"name": "Emerging Markets Equity Fund", "account": "Traditional IRA", "value": 4966.40, "change": 0},
    {"name": "Large Cap Value Fund", "account": "Traditional IRA", "value": 3274.80, "change": 0},
    {"name": "State Street Nasdaq-100 Index NL Cl M", "account": "Traditional IRA", "value": 12914.84, "change": 0},
    {"name": "State Street S&P 500 Index Fund NL Cl M", "account": "Traditional IRA", "value": 11298.16, "change": 0}
]

# Full Account Statement (History)
# This drives the 'Accounts' tab
account_statement = {
    "id": 1,
    "name": "401(k) Statement",
    "summary": {
        "beginning_balance": 1305721.29,
        "deposits": 51983.33,
        "withdrawals": -1527876.45,
        "dividends": 2057.03,
        "change": 200569.00,
        "ending_balance": 32454.20,
        "vested_balance": 32454.20
    },
    "sources": [
        {"name": "Before Tax Account", "begin": 725989.72, "deposits": 31913.91, "withdrawals": -852315.41, "end": 18142.00},
        {"name": "Discretionary Profit Sharing Account", "begin": 8972.85, "deposits": 0.00, "withdrawals": -10347.89, "end": 0.00},
        {"name": "Matching Contribution Account", "begin": 63385.22, "deposits": 13988.80, "withdrawals": -73089.17, "end": 14312.20},
        {"name": "Roth Account", "begin": 187584.76, "deposits": 6080.62, "withdrawals": -223328.78, "end": 0.00},
        {"name": "Safe Harbor Match Account- Frozen", "begin": 319788.74, "deposits": 0.00, "withdrawals": -368795.20, "end": 0.00}
    ],
    "holdings": [
        {"name": "Core Bond Fund", "begin": 0.00, "end": 0.00, "shares": 0.000000},
        {"name": "Emerging Markets Equity Fund", "begin": 120104.66, "end": 4966.40, "shares": 235.240433},
        {"name": "Wells Fargo ESOP Fund", "begin": 115694.56, "end": 0.00, "shares": 0.000000},
        {"name": "Small Cap Fund", "begin": 24388.78, "end": 0.00, "shares": 0.000000},
        {"name": "State Street S&P Mid Cap Index NL Cl M", "begin": 61789.13, "end": 0.00, "shares": 0.000000},
        {"name": "Large Cap Growth Fund", "begin": 329490.89, "end": 0.00, "shares": 0.000000},
        {"name": "Large Cap Value Fund", "begin": 123535.28, "end": 3274.80, "shares": 53.201931},
        {"name": "State Street Nasdaq-100 Index NL Cl M", "begin": 177202.17, "end": 12914.84, "shares": 73.554008},
        {"name": "State Street S&P 500 Index Fund NL Cl M", "begin": 0.00, "end": 11298.16, "shares": 932.730260},
        {"name": "State Street S&P 500 Index K", "begin": 331022.70, "end": 0.00, "shares": 0.000000},
        {"name": "Global Bond Fund", "begin": 22493.12, "end": 0.00, "shares": 0.000000}
    ]
}

# 2. Construct Profile Payload
# ----------------------------
profile_data = {
    "person1": {
        "name": "Person 1",
        "birth_date": "1970-01-01",
        "retirement_date": "2035-01-01",
        "social_security": 3000
    },
    "person2": {
        "name": "Person 2",
        "birth_date": "1972-01-01",
        "retirement_date": "2037-01-01",
        "social_security": 2500
    },
    "children": [],
    
    # ZERO OUT all top-level asset buckets
    "liquid_assets": 0,
    "traditional_ira": 0,
    "roth_ira": 0,
    "pension_lump_sum": 0,
    
    "annual_expenses": 100000,
    "target_annual_income": 150000,
    "risk_tolerance": "moderate",
    
    # Update lists
    "investment_types": investment_types,
    "accounts": [account_statement],
    "future_expenses": [],
    
    "asset_allocation": {"stocks": 0.5, "bonds": 0.5},
    "market_assumptions": {}
}

# 3. Send Request
# ---------------
req = urllib.request.Request(
    API_URL, 
    data=json.dumps(profile_data).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    print(f"Updating profile 'Baseline' with sanitized data...")
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print(f"Success: {result}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
except urllib.error.URLError as e:
    print(f"Connection Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
