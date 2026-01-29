#!/usr/bin/env python3
"""
Seed the database with the full set of Demo profiles.
Replaces the existing 'demo' user data with:
1. Demo Junior (Alex - Junior Employee)
2. Demo Thompson (Tom & Tara - Family/Mid-Career)
3. Demo Starman (Stella - FIRE/High Earner)
4. Demo Dudeman (The Dude - Coasting)

IMPORTANT: Demo account stores all data UNENCRYPTED for easy testing.
No DEK or recovery codes needed.
"""

import sys
import os
import sqlite3
import json
import bcrypt
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

DB_PATH = '/var/www/rps.pan2.app/data/planning.db'
# Fallback for local dev
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'planning.db')

def seed_demo_data():
    print(f"Seeding full demo data into: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Setup Demo User (NO ENCRYPTION)
        username = 'demo'
        email = 'demo@example.com'
        password = 'Demo1234'

        # Hash Password only
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Upsert User - NO DEK, NO ENCRYPTION
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        existing_user = cursor.fetchone()

        user_id = None
        if existing_user:
            user_id = existing_user['id']
            print(f"Updating existing user '{username}' (ID: {user_id})")
            cursor.execute("""
                UPDATE users
                SET password_hash = ?, encrypted_dek = NULL, dek_iv = NULL,
                    recovery_encrypted_dek = NULL, recovery_iv = NULL, recovery_salt = NULL,
                    email_verified = 1, updated_at = ?
                WHERE id = ?
            """, (password_hash, datetime.now().isoformat(), user_id))
        else:
            print(f"Creating new user '{username}'")
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, is_active, is_admin,
                                 encrypted_dek, dek_iv, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, 1, 0, NULL, NULL, 1, ?, ?)
            """, (username, email, password_hash,
                  datetime.now().isoformat(), datetime.now().isoformat()))
            user_id = cursor.lastrowid

        # Current date for calculations
        today = datetime.now()
        today_str = today.strftime("%Y-%m-%d")

        # ============================================
        # PROFILE DATA DEFINITIONS
        # ============================================

        # DEMO JUNIOR - Entry Level Developer, 26yo
        junior_data = {
            "profile_name": "Demo Junior",
            "person": {
                "name": "Alex Junior",
                "birth_date": "2000-05-15",
                "retirement_date": "2065-05-15",
                "life_expectancy": 95
            },
            "spouse": {},
            "children": [],
            "income_streams": [
                {"name": "Software Developer Salary", "amount": 5833, "source": "employment", "start_date": "2022-06-01", "end_date": ""},
                {"name": "Annual Bonus (Prorated)", "amount": 400, "source": "employment", "start_date": "2023-01-01", "end_date": ""},
                {"name": "Side Project Income", "amount": 250, "source": "self_employment", "start_date": "2024-03-01", "end_date": ""}
            ],
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [
                            {"name": "Rent (1BR Apartment)", "amount": 1650, "frequency": "monthly"},
                            {"name": "Renters Insurance", "amount": 25, "frequency": "monthly"}
                        ],
                        "utilities": [
                            {"name": "Electric", "amount": 55, "frequency": "monthly"},
                            {"name": "Gas", "amount": 30, "frequency": "monthly"},
                            {"name": "Internet", "amount": 65, "frequency": "monthly"},
                            {"name": "Cell Phone", "amount": 45, "frequency": "monthly"}
                        ],
                        "food": [
                            {"name": "Groceries", "amount": 320, "frequency": "monthly"},
                            {"name": "Restaurants", "amount": 150, "frequency": "monthly"},
                            {"name": "Coffee/Snacks", "amount": 60, "frequency": "monthly"},
                            {"name": "Food Delivery Apps", "amount": 80, "frequency": "monthly"}
                        ],
                        "transportation": [
                            {"name": "Car Payment (Honda Civic)", "amount": 350, "frequency": "monthly"},
                            {"name": "Gas", "amount": 120, "frequency": "monthly"},
                            {"name": "Car Insurance", "amount": 95, "frequency": "monthly"},
                            {"name": "Parking", "amount": 50, "frequency": "monthly"}
                        ],
                        "healthcare": [
                            {"name": "Health Insurance (via employer)", "amount": 120, "frequency": "monthly"},
                            {"name": "Dental/Vision", "amount": 25, "frequency": "monthly"}
                        ],
                        "entertainment": [
                            {"name": "Netflix", "amount": 15, "frequency": "monthly"},
                            {"name": "Spotify", "amount": 11, "frequency": "monthly"},
                            {"name": "Gaming", "amount": 30, "frequency": "monthly"},
                            {"name": "Bars/Social", "amount": 100, "frequency": "monthly"}
                        ],
                        "personal": [
                            {"name": "Gym Membership", "amount": 40, "frequency": "monthly"},
                            {"name": "Clothing", "amount": 75, "frequency": "monthly"}
                        ],
                        "education": [
                            {"name": "Student Loan Payment", "amount": 300, "frequency": "monthly"},
                            {"name": "Online Courses", "amount": 25, "frequency": "monthly"}
                        ],
                        "savings": [
                            {"name": "401k Contribution", "amount": 583, "frequency": "monthly"},
                            {"name": "Roth IRA", "amount": 250, "frequency": "monthly"},
                            {"name": "Emergency Fund", "amount": 200, "frequency": "monthly"}
                        ],
                        "other": [
                            {"name": "Pet (Cat)", "amount": 50, "frequency": "monthly"},
                            {"name": "Miscellaneous", "amount": 75, "frequency": "monthly"}
                        ]
                    },
                    "future": {
                        "housing": [{"name": "Housing", "amount": 1200, "frequency": "monthly"}],
                        "utilities": [{"name": "Utilities", "amount": 150, "frequency": "monthly"}],
                        "food": [{"name": "Food", "amount": 400, "frequency": "monthly"}],
                        "healthcare": [{"name": "Healthcare", "amount": 350, "frequency": "monthly"}],
                        "entertainment": [{"name": "Entertainment", "amount": 200, "frequency": "monthly"}],
                        "other": [{"name": "Other", "amount": 200, "frequency": "monthly"}]
                    }
                }
            },
            "assets": {
                "taxable_accounts": [
                    {"name": "Checking Account", "type": "checking", "value": 3500, "cost_basis": 3500},
                    {"name": "Emergency Fund (HYSA)", "type": "savings", "value": 8500, "cost_basis": 8500}
                ],
                "retirement_accounts": [
                    {"name": "401k", "type": "401k", "value": 18000, "cost_basis": 15000},
                    {"name": "Roth IRA", "type": "roth_ira", "value": 9500, "cost_basis": 8000}
                ]
            },
            "liabilities": [
                {"name": "Student Loans", "type": "student_loan", "balance": 28000, "interest_rate": 5.5, "monthly_payment": 300}
            ],
            "market_assumptions": {"stock_allocation": 0.90, "stock_return_mean": 0.10, "inflation_mean": 0.03}
        }

        # DEMO THOMPSON - Upper-Middle Class Family, Bay Area
        thompson_data = {
            "profile_name": "Demo Thompson",
            "person": {
                "name": "Tom Thompson",
                "birth_date": "1979-06-15",
                "retirement_date": "2044-06-15",
                "life_expectancy": 90
            },
            "spouse": {
                "name": "Tara Thompson",
                "birth_date": "1981-08-20",
                "retirement_date": "2046-08-20"
            },
            "children": [
                {"name": "Tyler", "birth_date": "2008-03-12"},
                {"name": "Taylor", "birth_date": "2010-09-25"}
            ],
            "income_streams": [
                {"name": "Tom - Senior Engineer Base", "amount": 16500, "source": "employment", "start_date": "2015-01-15", "end_date": ""},
                {"name": "Tom - Annual Bonus", "amount": 2000, "source": "employment", "start_date": "2015-01-15", "end_date": ""},
                {"name": "Tara - Product Manager Base", "amount": 12000, "source": "employment", "start_date": "2016-03-01", "end_date": ""},
                {"name": "RSU Vesting (Monthly Avg)", "amount": 3500, "source": "investment", "start_date": "2020-01-01", "end_date": ""},
                {"name": "Dividend Income", "amount": 450, "source": "investment", "start_date": "2018-01-01", "end_date": ""},
                {"name": "Rental Property (Net)", "amount": 800, "source": "rental", "start_date": "2021-06-01", "end_date": ""}
            ],
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [
                            {"name": "Mortgage (SF Home)", "amount": 5200, "frequency": "monthly"},
                            {"name": "Property Tax", "amount": 1450, "frequency": "monthly"},
                            {"name": "Home Insurance", "amount": 280, "frequency": "monthly"},
                            {"name": "HOA Fees", "amount": 350, "frequency": "monthly"}
                        ],
                        "utilities": [
                            {"name": "PG&E", "amount": 250, "frequency": "monthly"},
                            {"name": "Water/Garbage", "amount": 120, "frequency": "monthly"},
                            {"name": "Internet/Cable", "amount": 180, "frequency": "monthly"},
                            {"name": "Phone (Family Plan)", "amount": 200, "frequency": "monthly"}
                        ],
                        "food": [
                            {"name": "Groceries", "amount": 1200, "frequency": "monthly"},
                            {"name": "Dining Out", "amount": 600, "frequency": "monthly"}
                        ],
                        "transportation": [
                            {"name": "Tesla Model Y Payment", "amount": 650, "frequency": "monthly"},
                            {"name": "Toyota Sienna Payment", "amount": 450, "frequency": "monthly"},
                            {"name": "Auto Insurance (2 cars)", "amount": 280, "frequency": "monthly"},
                            {"name": "Gas/Charging", "amount": 200, "frequency": "monthly"}
                        ],
                        "insurance": [
                            {"name": "Term Life Insurance", "amount": 150, "frequency": "monthly"},
                            {"name": "Umbrella Policy", "amount": 50, "frequency": "monthly"}
                        ],
                        "healthcare": [
                            {"name": "Health Insurance (Family)", "amount": 800, "frequency": "monthly"},
                            {"name": "Out of Pocket Medical", "amount": 200, "frequency": "monthly"}
                        ],
                        "childcare": [
                            {"name": "After-School Programs", "amount": 600, "frequency": "monthly"},
                            {"name": "Summer Camps", "amount": 400, "frequency": "monthly"}
                        ],
                        "entertainment": [
                            {"name": "Family Activities", "amount": 500, "frequency": "monthly"},
                            {"name": "Streaming Services", "amount": 100, "frequency": "monthly"},
                            {"name": "Kids Sports/Activities", "amount": 400, "frequency": "monthly"}
                        ],
                        "travel": [{"name": "Family Vacations", "amount": 800, "frequency": "monthly"}],
                        "education": [{"name": "Tutoring/Music Lessons", "amount": 400, "frequency": "monthly"}],
                        "personal": [
                            {"name": "Clothing (Family)", "amount": 300, "frequency": "monthly"},
                            {"name": "Personal Care", "amount": 200, "frequency": "monthly"}
                        ],
                        "other": [
                            {"name": "Gifts/Charity", "amount": 400, "frequency": "monthly"},
                            {"name": "Miscellaneous", "amount": 300, "frequency": "monthly"}
                        ]
                    },
                    "future": {
                        "housing": [
                            {"name": "Property Tax", "amount": 1800, "frequency": "monthly"},
                            {"name": "Home Insurance", "amount": 350, "frequency": "monthly"},
                            {"name": "Home Maintenance", "amount": 500, "frequency": "monthly"}
                        ],
                        "utilities": [{"name": "Utilities", "amount": 400, "frequency": "monthly"}],
                        "food": [{"name": "Food", "amount": 1000, "frequency": "monthly"}],
                        "healthcare": [{"name": "Healthcare", "amount": 1200, "frequency": "monthly"}],
                        "transportation": [{"name": "Transportation", "amount": 400, "frequency": "monthly"}],
                        "travel": [{"name": "Travel", "amount": 1500, "frequency": "monthly"}],
                        "entertainment": [{"name": "Entertainment", "amount": 600, "frequency": "monthly"}],
                        "other": [{"name": "Other", "amount": 500, "frequency": "monthly"}]
                    }
                }
            },
            "assets": {
                "taxable_accounts": [
                    {"name": "Joint Checking", "type": "checking", "value": 25000, "cost_basis": 25000},
                    {"name": "Joint Savings (HYSA)", "type": "savings", "value": 85000, "cost_basis": 85000},
                    {"name": "Vanguard Brokerage", "type": "brokerage", "value": 320000, "cost_basis": 180000},
                    {"name": "Company Stock (FAANG)", "type": "stock", "value": 450000, "cost_basis": 150000}
                ],
                "retirement_accounts": [
                    {"name": "Tom 401k", "type": "401k", "value": 680000, "cost_basis": 450000},
                    {"name": "Tara 401k", "type": "401k", "value": 420000, "cost_basis": 300000},
                    {"name": "Tom Roth IRA", "type": "roth_ira", "value": 95000, "cost_basis": 70000},
                    {"name": "Tara Roth IRA", "type": "roth_ira", "value": 85000, "cost_basis": 65000}
                ],
                "real_estate": [
                    {"name": "Primary Home (San Francisco)", "value": 1850000, "mortgage": 620000, "monthly_payment": 5200, "interest_rate": 3.25}
                ],
                "education_accounts": [
                    {"name": "Tyler 529", "type": "529", "value": 125000, "cost_basis": 90000},
                    {"name": "Taylor 529", "type": "529", "value": 95000, "cost_basis": 75000}
                ]
            },
            "college_expenses": [
                {"child_name": "Tyler", "start_year": 2026, "end_year": 2030, "annual_cost": 75000, "enabled": True},
                {"child_name": "Taylor", "start_year": 2028, "end_year": 2032, "annual_cost": 75000, "enabled": True}
            ],
            "market_assumptions": {"stock_allocation": 0.70, "stock_return_mean": 0.08, "inflation_mean": 0.03}
        }

        # DEMO STARMAN - Middle Class Family, Austin TX
        starman_data = {
            "profile_name": "Demo Starman",
            "person": {
                "name": "Steve Starman",
                "birth_date": "1984-03-10",
                "retirement_date": "2049-03-10",
                "life_expectancy": 92
            },
            "spouse": {
                "name": "Sarah Starman",
                "birth_date": "1986-07-22",
                "retirement_date": "2051-07-22"
            },
            "children": [
                {"name": "Sophie", "birth_date": "2012-04-15"},
                {"name": "Sam", "birth_date": "2015-11-08"},
                {"name": "Stella Jr", "birth_date": "2019-02-28"}
            ],
            "income_streams": [
                {"name": "Steve - IT Manager Base", "amount": 8500, "source": "employment", "start_date": "2018-06-01", "end_date": ""},
                {"name": "Steve - Annual Bonus", "amount": 700, "source": "employment", "start_date": "2018-06-01", "end_date": ""},
                {"name": "Sarah - Nurse (Part-Time)", "amount": 4200, "source": "employment", "start_date": "2020-01-15", "end_date": ""},
                {"name": "Sarah - PRN Shifts", "amount": 600, "source": "employment", "start_date": "2022-01-01", "end_date": ""},
                {"name": "Dividend Income", "amount": 120, "source": "investment", "start_date": "2020-01-01", "end_date": ""}
            ],
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [
                            {"name": "Mortgage", "amount": 2400, "frequency": "monthly"},
                            {"name": "Property Tax", "amount": 750, "frequency": "monthly"},
                            {"name": "Home Insurance", "amount": 180, "frequency": "monthly"}
                        ],
                        "utilities": [
                            {"name": "Electric (TX Heat!)", "amount": 220, "frequency": "monthly"},
                            {"name": "Water/Sewer", "amount": 80, "frequency": "monthly"},
                            {"name": "Internet", "amount": 70, "frequency": "monthly"},
                            {"name": "Phone (Family)", "amount": 160, "frequency": "monthly"}
                        ],
                        "food": [
                            {"name": "Groceries", "amount": 900, "frequency": "monthly"},
                            {"name": "Dining Out", "amount": 300, "frequency": "monthly"}
                        ],
                        "transportation": [
                            {"name": "Honda Pilot Payment", "amount": 480, "frequency": "monthly"},
                            {"name": "Toyota Camry Payment", "amount": 320, "frequency": "monthly"},
                            {"name": "Auto Insurance", "amount": 200, "frequency": "monthly"},
                            {"name": "Gas", "amount": 280, "frequency": "monthly"}
                        ],
                        "insurance": [{"name": "Term Life", "amount": 80, "frequency": "monthly"}],
                        "healthcare": [
                            {"name": "Health Insurance", "amount": 450, "frequency": "monthly"},
                            {"name": "Medical/Dental", "amount": 150, "frequency": "monthly"}
                        ],
                        "childcare": [{"name": "Daycare (Stella Jr)", "amount": 1100, "frequency": "monthly"}],
                        "entertainment": [
                            {"name": "Family Activities", "amount": 250, "frequency": "monthly"},
                            {"name": "Streaming/Games", "amount": 60, "frequency": "monthly"},
                            {"name": "Kids Activities", "amount": 200, "frequency": "monthly"}
                        ],
                        "education": [{"name": "School Supplies/Activities", "amount": 100, "frequency": "monthly"}],
                        "personal": [
                            {"name": "Clothing", "amount": 200, "frequency": "monthly"},
                            {"name": "Personal Care", "amount": 100, "frequency": "monthly"}
                        ],
                        "other": [
                            {"name": "Pets", "amount": 100, "frequency": "monthly"},
                            {"name": "Gifts", "amount": 150, "frequency": "monthly"},
                            {"name": "Miscellaneous", "amount": 200, "frequency": "monthly"}
                        ]
                    },
                    "future": {
                        "housing": [
                            {"name": "Property Tax", "amount": 900, "frequency": "monthly"},
                            {"name": "Insurance/Maintenance", "amount": 400, "frequency": "monthly"}
                        ],
                        "utilities": [{"name": "Utilities", "amount": 300, "frequency": "monthly"}],
                        "food": [{"name": "Food", "amount": 800, "frequency": "monthly"}],
                        "healthcare": [{"name": "Healthcare", "amount": 800, "frequency": "monthly"}],
                        "transportation": [{"name": "Transportation", "amount": 300, "frequency": "monthly"}],
                        "travel": [{"name": "Travel", "amount": 600, "frequency": "monthly"}],
                        "entertainment": [{"name": "Entertainment", "amount": 400, "frequency": "monthly"}],
                        "other": [{"name": "Other", "amount": 300, "frequency": "monthly"}]
                    }
                }
            },
            "assets": {
                "taxable_accounts": [
                    {"name": "Joint Checking", "type": "checking", "value": 8500, "cost_basis": 8500},
                    {"name": "Emergency Fund", "type": "savings", "value": 32000, "cost_basis": 32000},
                    {"name": "Brokerage Account", "type": "brokerage", "value": 45000, "cost_basis": 35000}
                ],
                "retirement_accounts": [
                    {"name": "Steve 401k", "type": "401k", "value": 285000, "cost_basis": 200000},
                    {"name": "Sarah 403b", "type": "403b", "value": 125000, "cost_basis": 95000},
                    {"name": "Steve Roth IRA", "type": "roth_ira", "value": 48000, "cost_basis": 40000},
                    {"name": "Sarah Roth IRA", "type": "roth_ira", "value": 32000, "cost_basis": 28000}
                ],
                "real_estate": [
                    {"name": "Primary Home (Austin)", "value": 485000, "mortgage": 320000, "monthly_payment": 2400, "interest_rate": 4.5}
                ],
                "education_accounts": [
                    {"name": "Sophie 529", "type": "529", "value": 28000, "cost_basis": 22000},
                    {"name": "Sam 529", "type": "529", "value": 18000, "cost_basis": 15000},
                    {"name": "Stella Jr 529", "type": "529", "value": 8000, "cost_basis": 7000}
                ]
            },
            "college_expenses": [
                {"child_name": "Sophie", "start_year": 2030, "end_year": 2034, "annual_cost": 45000, "enabled": True},
                {"child_name": "Sam", "start_year": 2033, "end_year": 2037, "annual_cost": 45000, "enabled": True},
                {"child_name": "Stella Jr", "start_year": 2037, "end_year": 2041, "annual_cost": 45000, "enabled": True}
            ],
            "market_assumptions": {"stock_allocation": 0.75, "stock_return_mean": 0.08, "inflation_mean": 0.03}
        }

        # DEMO DUDEMAN - Blue Collar, IBEW Electrician
        dudeman_data = {
            "profile_name": "Demo Dudeman",
            "person": {
                "name": "Dan Dudeman",
                "birth_date": "1974-11-05",
                "retirement_date": "2036-11-05",
                "life_expectancy": 85
            },
            "spouse": {},
            "children": [],
            "income_streams": [
                {"name": "IBEW Electrician - Base Pay", "amount": 5400, "source": "employment", "start_date": "2005-03-15", "end_date": ""},
                {"name": "IBEW - Overtime (Avg)", "amount": 500, "source": "employment", "start_date": "2005-03-15", "end_date": ""},
                {"name": "Side Jobs (Cash)", "amount": 350, "source": "self_employment", "start_date": "2010-01-01", "end_date": ""},
                {"name": "Union Pension (Future)", "amount": 3200, "source": "pension", "start_date": "2036-11-05", "end_date": ""}
            ],
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [
                            {"name": "Property Tax", "amount": 350, "frequency": "monthly"},
                            {"name": "Home Insurance", "amount": 120, "frequency": "monthly"},
                            {"name": "Maintenance", "amount": 200, "frequency": "monthly"}
                        ],
                        "utilities": [
                            {"name": "Electric/Gas", "amount": 180, "frequency": "monthly"},
                            {"name": "Water/Sewer", "amount": 60, "frequency": "monthly"},
                            {"name": "Internet", "amount": 55, "frequency": "monthly"},
                            {"name": "Phone", "amount": 50, "frequency": "monthly"}
                        ],
                        "food": [
                            {"name": "Groceries", "amount": 400, "frequency": "monthly"},
                            {"name": "Dining/Beer", "amount": 200, "frequency": "monthly"}
                        ],
                        "transportation": [
                            {"name": "Truck Payment", "amount": 450, "frequency": "monthly"},
                            {"name": "Gas", "amount": 250, "frequency": "monthly"},
                            {"name": "Insurance", "amount": 110, "frequency": "monthly"}
                        ],
                        "insurance": [{"name": "Union Health Plan", "amount": 180, "frequency": "monthly"}],
                        "entertainment": [
                            {"name": "Bowling League", "amount": 60, "frequency": "monthly"},
                            {"name": "Streaming", "amount": 30, "frequency": "monthly"},
                            {"name": "Fishing/Hunting", "amount": 100, "frequency": "monthly"}
                        ],
                        "personal": [
                            {"name": "Clothing/Work Gear", "amount": 75, "frequency": "monthly"},
                            {"name": "Personal", "amount": 50, "frequency": "monthly"}
                        ],
                        "other": [
                            {"name": "Union Dues", "amount": 85, "frequency": "monthly"},
                            {"name": "Miscellaneous", "amount": 150, "frequency": "monthly"}
                        ]
                    },
                    "future": {
                        "housing": [
                            {"name": "Property Tax", "amount": 400, "frequency": "monthly"},
                            {"name": "Insurance/Maintenance", "amount": 350, "frequency": "monthly"}
                        ],
                        "utilities": [{"name": "Utilities", "amount": 250, "frequency": "monthly"}],
                        "food": [{"name": "Food", "amount": 500, "frequency": "monthly"}],
                        "healthcare": [{"name": "Medicare + Supplement", "amount": 400, "frequency": "monthly"}],
                        "transportation": [{"name": "Transportation", "amount": 250, "frequency": "monthly"}],
                        "entertainment": [{"name": "Entertainment/Hobbies", "amount": 300, "frequency": "monthly"}],
                        "other": [{"name": "Other", "amount": 200, "frequency": "monthly"}]
                    }
                }
            },
            "assets": {
                "taxable_accounts": [
                    {"name": "Checking", "type": "checking", "value": 4500, "cost_basis": 4500},
                    {"name": "Savings", "type": "savings", "value": 18000, "cost_basis": 18000}
                ],
                "retirement_accounts": [
                    {"name": "IBEW Pension", "type": "pension", "value": 0, "monthly_benefit": 3200, "start_age": 62},
                    {"name": "401k (Electrical)", "type": "401k", "value": 125000, "cost_basis": 90000},
                    {"name": "Traditional IRA", "type": "traditional_ira", "value": 45000, "cost_basis": 40000}
                ],
                "real_estate": [
                    {"name": "House (Columbus, OH)", "value": 245000, "mortgage": 0}
                ]
            },
            "market_assumptions": {"stock_allocation": 0.50, "stock_return_mean": 0.07, "inflation_mean": 0.03}
        }

        profiles = [
            {"name": "Demo Junior", "data": junior_data},
            {"name": "Demo Thompson", "data": thompson_data},
            {"name": "Demo Starman", "data": starman_data},
            {"name": "Demo Dudeman", "data": dudeman_data}
        ]

        # ============================================
        # CLEAR EXISTING DEMO DATA
        # ============================================
        print("Clearing existing demo data...")
        cursor.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM action_items WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM scenarios WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM profile WHERE user_id = ?", (user_id,))

        # ============================================
        # CREATE PROFILES (UNENCRYPTED - plain JSON)
        # ============================================
        profile_ids = {}
        for p in profiles:
            print(f"  Creating profile: {p['name']}")
            # Store as plain JSON - NO ENCRYPTION
            cursor.execute("""
                INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
            """, (
                user_id,
                p['name'],
                p['data']['person']['birth_date'],
                p['data']['person']['retirement_date'],
                json.dumps(p['data']),  # Plain JSON, not encrypted
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            profile_ids[p['name']] = cursor.lastrowid

        # ============================================
        # CREATE SCENARIOS FOR EACH PROFILE
        # ============================================
        print("Creating scenarios...")

        scenarios_data = {
            "Demo Junior": [
                {
                    "name": "Base Case - Standard Path",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.90, "monthly_contribution": 1033, "inflation": 0.03},
                    "results": {"success_rate": 0.87, "median_ending_balance": 2850000, "percentile_10": 1200000, "percentile_90": 5100000}
                },
                {
                    "name": "Aggressive Savings",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.95, "monthly_contribution": 1500, "inflation": 0.03},
                    "results": {"success_rate": 0.92, "median_ending_balance": 3400000, "percentile_10": 1500000, "percentile_90": 6200000}
                },
                {
                    "name": "Early Retirement at 55",
                    "parameters": {"retirement_age": 55, "stock_allocation": 0.85, "monthly_contribution": 1033, "inflation": 0.03},
                    "results": {"success_rate": 0.72, "median_ending_balance": 1800000, "percentile_10": 750000, "percentile_90": 3200000}
                }
            ],
            "Demo Thompson": [
                {
                    "name": "Base Case - Current Plan",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.70, "monthly_contribution": 5000, "inflation": 0.03},
                    "results": {"success_rate": 0.94, "median_ending_balance": 8500000, "percentile_10": 4200000, "percentile_90": 14000000}
                },
                {
                    "name": "Tom Retires at 60",
                    "parameters": {"retirement_age": 60, "stock_allocation": 0.65, "monthly_contribution": 5000, "inflation": 0.03},
                    "results": {"success_rate": 0.89, "median_ending_balance": 6800000, "percentile_10": 3400000, "percentile_90": 11000000}
                },
                {
                    "name": "Conservative - Market Downturn",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.50, "monthly_contribution": 5000, "inflation": 0.04},
                    "results": {"success_rate": 0.86, "median_ending_balance": 6200000, "percentile_10": 3100000, "percentile_90": 9800000}
                }
            ],
            "Demo Starman": [
                {
                    "name": "Base Case - Standard Plan",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.75, "monthly_contribution": 2000, "inflation": 0.03},
                    "results": {"success_rate": 0.88, "median_ending_balance": 3200000, "percentile_10": 1600000, "percentile_90": 5400000}
                },
                {
                    "name": "Sarah Works Full-Time",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.75, "monthly_contribution": 3200, "inflation": 0.03},
                    "results": {"success_rate": 0.93, "median_ending_balance": 4100000, "percentile_10": 2100000, "percentile_90": 6800000}
                },
                {
                    "name": "Kids College Fully Funded",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.75, "monthly_contribution": 1500, "college_costs": 405000, "inflation": 0.03},
                    "results": {"success_rate": 0.82, "median_ending_balance": 2600000, "percentile_10": 1300000, "percentile_90": 4400000}
                }
            ],
            "Demo Dudeman": [
                {
                    "name": "Base Case - Retire at 62",
                    "parameters": {"retirement_age": 62, "stock_allocation": 0.50, "monthly_contribution": 800, "pension": 3200, "inflation": 0.03},
                    "results": {"success_rate": 0.91, "median_ending_balance": 850000, "percentile_10": 420000, "percentile_90": 1400000}
                },
                {
                    "name": "Work Until 65",
                    "parameters": {"retirement_age": 65, "stock_allocation": 0.50, "monthly_contribution": 800, "pension": 3600, "inflation": 0.03},
                    "results": {"success_rate": 0.96, "median_ending_balance": 1100000, "percentile_10": 580000, "percentile_90": 1700000}
                },
                {
                    "name": "Social Security at 70",
                    "parameters": {"retirement_age": 62, "stock_allocation": 0.45, "ss_start_age": 70, "pension": 3200, "inflation": 0.03},
                    "results": {"success_rate": 0.94, "median_ending_balance": 920000, "percentile_10": 480000, "percentile_90": 1500000}
                }
            ]
        }

        for profile_name, scenarios in scenarios_data.items():
            profile_id = profile_ids[profile_name]
            for scenario in scenarios:
                cursor.execute("""
                    INSERT INTO scenarios (user_id, profile_id, name, parameters, results, parameters_iv, results_iv, created_at)
                    VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
                """, (
                    user_id,
                    profile_id,
                    scenario['name'],
                    json.dumps(scenario['parameters']),
                    json.dumps(scenario['results']),
                    datetime.now().isoformat()
                ))

        # ============================================
        # CREATE ACTION ITEMS FOR EACH PROFILE
        # ============================================
        print("Creating action items...")

        action_items_data = {
            "Demo Junior": [
                {
                    "category": "savings",
                    "description": "Increase 401k contribution to capture full employer match (6%)",
                    "priority": "high",
                    "status": "pending",
                    "due_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
                    "action_data": {"target_contribution": 0.10, "current_contribution": 0.07},
                    "subtasks": ["Review 401k options", "Update contribution via HR portal", "Verify next paycheck"]
                },
                {
                    "category": "debt",
                    "description": "Refinance student loans to lower interest rate",
                    "priority": "medium",
                    "status": "in_progress",
                    "due_date": (today + timedelta(days=60)).strftime("%Y-%m-%d"),
                    "action_data": {"current_rate": 5.5, "target_rate": 4.5, "balance": 28000},
                    "subtasks": ["Check credit score", "Get quotes from SoFi and Earnest", "Compare terms"]
                },
                {
                    "category": "emergency_fund",
                    "description": "Build emergency fund to 3 months of expenses ($12,000)",
                    "priority": "high",
                    "status": "in_progress",
                    "due_date": (today + timedelta(days=180)).strftime("%Y-%m-%d"),
                    "action_data": {"current_balance": 8500, "target_balance": 12000},
                    "subtasks": ["Set up automatic transfer of $200/month", "Track progress monthly"]
                },
                {
                    "category": "investment",
                    "description": "Open taxable brokerage account for medium-term goals",
                    "priority": "low",
                    "status": "pending",
                    "due_date": (today + timedelta(days=90)).strftime("%Y-%m-%d"),
                    "action_data": {"suggested_platform": "Fidelity", "initial_deposit": 1000},
                    "subtasks": ["Research platforms", "Open account", "Set up auto-invest"]
                }
            ],
            "Demo Thompson": [
                {
                    "category": "tax",
                    "description": "Review RSU vesting schedule and plan for tax-loss harvesting",
                    "priority": "high",
                    "status": "pending",
                    "due_date": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
                    "action_data": {"rsu_value": 450000, "unrealized_gains": 300000},
                    "subtasks": ["Meet with tax advisor", "Review 2024 vesting dates", "Identify harvest opportunities"]
                },
                {
                    "category": "estate",
                    "description": "Update estate plan and beneficiary designations",
                    "priority": "medium",
                    "status": "pending",
                    "due_date": (today + timedelta(days=90)).strftime("%Y-%m-%d"),
                    "action_data": {"last_updated": "2019", "children_ages": [16, 14]},
                    "subtasks": ["Schedule meeting with estate attorney", "Review trust provisions", "Update 401k beneficiaries"]
                },
                {
                    "category": "college",
                    "description": "Increase 529 contributions for Tyler (college in 2 years)",
                    "priority": "high",
                    "status": "in_progress",
                    "due_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
                    "action_data": {"current_529_balance": 125000, "target_balance": 200000, "years_to_college": 2},
                    "subtasks": ["Increase monthly contribution to $2000", "Review investment allocation"]
                },
                {
                    "category": "insurance",
                    "description": "Review term life insurance coverage adequacy",
                    "priority": "medium",
                    "status": "completed",
                    "due_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"),
                    "action_data": {"current_coverage": 1500000, "recommended": 2000000},
                    "subtasks": ["Get quotes for additional coverage", "Compare term lengths"]
                },
                {
                    "category": "rebalance",
                    "description": "Rebalance portfolio - reduce company stock concentration",
                    "priority": "high",
                    "status": "pending",
                    "due_date": (today + timedelta(days=60)).strftime("%Y-%m-%d"),
                    "action_data": {"company_stock_pct": 0.18, "target_pct": 0.10},
                    "subtasks": ["Review 10b5-1 plan options", "Diversify over 12 months", "Consider tax implications"]
                }
            ],
            "Demo Starman": [
                {
                    "category": "savings",
                    "description": "Max out both Roth IRAs for the year",
                    "priority": "high",
                    "status": "in_progress",
                    "due_date": (today + timedelta(days=120)).strftime("%Y-%m-%d"),
                    "action_data": {"steve_contributed": 4500, "sarah_contributed": 3200, "limit": 7000},
                    "subtasks": ["Set up automatic contributions", "Verify income eligibility"]
                },
                {
                    "category": "childcare",
                    "description": "Research pre-K options for Stella Jr",
                    "priority": "medium",
                    "status": "pending",
                    "due_date": (today + timedelta(days=90)).strftime("%Y-%m-%d"),
                    "action_data": {"current_cost": 1100, "potential_savings": 300},
                    "subtasks": ["Tour 3 pre-K programs", "Check waitlists", "Compare costs"]
                },
                {
                    "category": "college",
                    "description": "Set up 529 auto-increase for all kids",
                    "priority": "medium",
                    "status": "pending",
                    "due_date": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
                    "action_data": {"annual_increase": 0.05},
                    "subtasks": ["Log into 529 accounts", "Enable auto-escalation", "Review allocations"]
                },
                {
                    "category": "budget",
                    "description": "Review and reduce dining out expenses",
                    "priority": "low",
                    "status": "completed",
                    "due_date": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "action_data": {"previous_monthly": 450, "current_monthly": 300, "savings": 150},
                    "subtasks": ["Meal planning", "Batch cooking Sundays"]
                }
            ],
            "Demo Dudeman": [
                {
                    "category": "retirement",
                    "description": "Schedule meeting with union pension advisor",
                    "priority": "high",
                    "status": "pending",
                    "due_date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
                    "action_data": {"years_to_retirement": 10, "pension_estimate": 3200},
                    "subtasks": ["Call union hall", "Gather pension statements", "Review benefit options"]
                },
                {
                    "category": "social_security",
                    "description": "Create SSA account and review projected benefits",
                    "priority": "medium",
                    "status": "pending",
                    "due_date": (today + timedelta(days=60)).strftime("%Y-%m-%d"),
                    "action_data": {"ssa_url": "ssa.gov"},
                    "subtasks": ["Create my Social Security account", "Review earnings history", "Estimate benefits at 62, 65, 70"]
                },
                {
                    "category": "healthcare",
                    "description": "Research Medicare options and supplemental plans",
                    "priority": "low",
                    "status": "pending",
                    "due_date": (today + timedelta(days=180)).strftime("%Y-%m-%d"),
                    "action_data": {"medicare_eligible": "2039"},
                    "subtasks": ["Understand Parts A, B, D", "Research Medigap plans", "Compare Medicare Advantage"]
                },
                {
                    "category": "investment",
                    "description": "Shift 401k to more conservative allocation",
                    "priority": "medium",
                    "status": "in_progress",
                    "due_date": (today + timedelta(days=45)).strftime("%Y-%m-%d"),
                    "action_data": {"current_stock_allocation": 0.65, "target_stock_allocation": 0.50},
                    "subtasks": ["Review target date fund options", "Rebalance to 50/50"]
                }
            ]
        }

        for profile_name, items in action_items_data.items():
            profile_id = profile_ids[profile_name]
            for item in items:
                cursor.execute("""
                    INSERT INTO action_items (user_id, profile_id, category, description, priority, status,
                                            due_date, action_data, subtasks, action_data_iv, subtasks_iv,
                                            created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
                """, (
                    user_id,
                    profile_id,
                    item['category'],
                    item['description'],
                    item['priority'],
                    item['status'],
                    item['due_date'],
                    json.dumps(item['action_data']),
                    json.dumps(item['subtasks']),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))

        # ============================================
        # CREATE CONVERSATIONS FOR EACH PROFILE
        # ============================================
        print("Creating conversation history...")

        conversations_data = {
            "Demo Junior": [
                {"role": "user", "content": "What's the best way to pay off my student loans faster?"},
                {"role": "assistant", "content": "Based on your profile, you have $28,000 in student loans at 5.5% interest. Here are some strategies:\n\n1. **Refinance**: Your credit score and income may qualify you for rates around 4-4.5%, saving ~$1,200 over the loan term.\n\n2. **Avalanche Method**: Focus extra payments on highest-rate debt first.\n\n3. **Employer Benefits**: Check if your company offers student loan repayment assistance.\n\n4. **Side Income**: Your $250/month side project income could go directly to loans, paying them off 2 years early.\n\nWould you like me to run scenarios comparing these approaches?"},
                {"role": "user", "content": "Should I prioritize student loans or investing in my 401k?"},
                {"role": "assistant", "content": "Great question! Let me analyze your specific situation:\n\n**Prioritize 401k up to the match first** - You're currently contributing 7%, but your employer likely matches up to 6%. That's free money with an immediate 100% return.\n\n**After the match, it's closer:**\n- Student loan interest: 5.5%\n- Expected long-term market returns: 7-10%\n\n**My recommendation for you:**\n1. Max employer 401k match (~$4,200/year)\n2. Build emergency fund to $12,000 (you're at $8,500)\n3. Then split extra between Roth IRA and loan paydown\n\nAt 26, time is your biggest asset. The compound growth over 40 years favors investing, but the psychological benefit of being debt-free is real too."}
            ],
            "Demo Thompson": [
                {"role": "user", "content": "How should we handle Tyler's college costs starting in 2026?"},
                {"role": "assistant", "content": "Looking at your situation with Tyler heading to college in 2 years:\n\n**Current Position:**\n- Tyler's 529: $125,000\n- Estimated 4-year cost: $300,000 (at $75k/year)\n- Gap: ~$175,000\n\n**Strategies to consider:**\n\n1. **Increase 529 contributions**: Even $2,000/month for 24 months adds $48,000 plus growth.\n\n2. **Use taxable brokerage**: Your $320k Vanguard account could cover gaps. Consider tax-loss harvesting now.\n\n3. **Cash flow during college**: Your combined income of $35k+/month gives flexibility.\n\n4. **Merit aid**: Encourage Tyler to apply for scholarships - even partial ones help.\n\n5. **Consider your RSUs**: Vesting stock could fund tuition directly.\n\nWant me to model the impact on your retirement projections?"},
                {"role": "user", "content": "We're worried about having too much in company stock. What should we do?"},
                {"role": "assistant", "content": "Your concern is valid - you have $450,000 in FAANG stock (about 18% of liquid investments). Financial advisors typically recommend keeping single-stock exposure under 10%.\n\n**Risks of concentration:**\n- Company-specific events can devastate wealth\n- Your income already depends on this company\n- Emotional attachment can cloud judgment\n\n**Diversification strategies:**\n\n1. **10b5-1 Plan**: Set up automatic sales regardless of stock price - removes emotion and insider trading concerns.\n\n2. **Staged selling**: Sell $75k/year over 6 years to spread capital gains.\n\n3. **Charitable giving**: Donate appreciated shares for tax benefits if philanthropically inclined.\n\n4. **Exchange funds**: Pool concentrated positions with others for diversification (complex but tax-efficient).\n\n**Tax consideration**: You have $300k in unrealized gains. Selling all at once could trigger ~$60k in federal taxes. Spreading over time keeps you in lower brackets.\n\nI'd recommend reducing to 10% ($190k) over 2-3 years."}
            ],
            "Demo Starman": [
                {"role": "user", "content": "With three kids, how do we balance college savings with retirement?"},
                {"role": "assistant", "content": "This is one of the most common dilemmas for families - and there's no perfect answer, but here's how to think about it:\n\n**The golden rule**: You can borrow for college, but not for retirement.\n\n**Your current situation:**\n- Combined 529s: $54,000\n- Estimated total college costs: $405,000 (3 kids × $45k × 3 years overlap)\n- Retirement savings: $490,000\n\n**Recommended approach:**\n\n1. **Max retirement match first** - Both of you should capture full employer matches\n\n2. **Target 50% college funding** - Aim to save ~$200k in 529s, kids can cover rest through:\n   - Merit scholarships\n   - Part-time work\n   - Modest student loans ($5-10k/year is manageable)\n\n3. **Stagger 529 contributions** - Sophie's college is closest, prioritize her 529\n\n4. **Consider Sarah's hours** - If she goes full-time even temporarily, that $2,400/month extra changes everything\n\nWant me to show scenarios with different college funding levels?"},
                {"role": "user", "content": "Should we pay off the mortgage early or invest more?"},
                {"role": "assistant", "content": "Let me crunch the numbers for your specific situation:\n\n**Your mortgage:**\n- Balance: $320,000\n- Rate: 4.5%\n- Payment: $2,400/month\n\n**The math favors investing**, but it's not overwhelming:\n- Expected market return: 7-8%\n- Mortgage interest (after tax): ~3.4% (assuming you itemize)\n- Spread: 3.5-4.5%\n\n**Arguments for investing:**\n- Higher expected returns\n- Liquidity - can access funds if needed\n- Tax-advantaged space (Roth IRAs) is use-it-or-lose-it\n\n**Arguments for mortgage payoff:**\n- Guaranteed 4.5% return\n- Psychological peace of mind\n- Reduces monthly obligations before retirement\n- Housing security if income disrupted\n\n**My recommendation for the Starmans:**\nMax out both Roth IRAs first ($14,000/year) - tax-free growth is too valuable to skip. Then split any extra 50/50 between mortgage and taxable investing.\n\nThis gives you the best of both worlds: tax-advantaged growth AND accelerated debt payoff."}
            ],
            "Demo Dudeman": [
                {"role": "user", "content": "When should I start taking Social Security?"},
                {"role": "assistant", "content": "Great question, Dan. This is one of the most important retirement decisions you'll make. Let me break it down:\n\n**Your situation:**\n- Planned retirement: 62 (2036)\n- Union pension: $3,200/month starting at 62\n- Paid-off house\n- Modest expenses (~$3,200/month)\n\n**Social Security options:**\n- Age 62: ~$1,800/month (reduced 30%)\n- Age 67 (FRA): ~$2,570/month (full benefit)\n- Age 70: ~$3,190/month (increased 24%)\n\n**My analysis:**\n\nWith your pension covering basic expenses and a paid-off house, you're in a good position to **delay Social Security to 70**.\n\n**Why wait?**\n1. Guaranteed 8%/year increase from 67-70\n2. Inflation-adjusted income for life\n3. Your 401k/IRA can bridge the gap\n4. Break-even age is around 80 - you could live to 85+\n\n**The strategy:**\n- Age 62-70: Live on pension ($3,200) + 401k withdrawals\n- Age 70+: Pension ($3,200) + SS ($3,190) = $6,390/month\n\nThat's a comfortable retirement with built-in inflation protection."},
                {"role": "user", "content": "How much can I safely withdraw from my retirement accounts?"},
                {"role": "assistant", "content": "Let's figure out a sustainable withdrawal strategy for you:\n\n**Your retirement assets:**\n- 401k: $125,000\n- Traditional IRA: $45,000\n- Savings: $18,000\n- Total: $188,000\n\n**The 4% rule** suggests ~$7,500/year ($625/month) as a safe starting withdrawal.\n\n**But your situation is better than that:**\n\n1. **Pension income** ($3,200/month) covers most expenses\n2. **Social Security** (delayed to 70) adds $3,190/month later\n3. **No mortgage** = lower expense baseline\n4. **Shorter retirement horizon** than typical (85 vs 95)\n\n**My recommended strategy:**\n\n**Ages 62-70 (bridge period):**\n- Pension: $3,200\n- Needed from savings: ~$1,000/month\n- 8 years × $12k = $96,000 from retirement accounts\n\n**Ages 70+:**\n- Pension: $3,200\n- Social Security: $3,190\n- Total: $6,390/month (likely more than you need!)\n- Remaining $90k+ becomes backup/legacy\n\nYou're actually in great shape, Dan. The combination of pension + delayed SS creates a secure income floor."}
            ]
        }

        for profile_name, messages in conversations_data.items():
            profile_id = profile_ids[profile_name]
            for i, msg in enumerate(messages):
                # Space out messages by a few minutes each
                msg_time = today - timedelta(days=7) + timedelta(minutes=i*5)
                cursor.execute("""
                    INSERT INTO conversations (user_id, profile_id, role, content, content_iv, created_at)
                    VALUES (?, ?, ?, ?, NULL, ?)
                """, (
                    user_id,
                    profile_id,
                    msg['role'],
                    msg['content'],
                    msg_time.isoformat()
                ))

        conn.commit()
        print(f"\nSuccessfully seeded demo data:")
        print(f"  - 4 profiles (unencrypted)")
        print(f"  - {sum(len(s) for s in scenarios_data.values())} scenarios")
        print(f"  - {sum(len(a) for a in action_items_data.values())} action items")
        print(f"  - {sum(len(c) for c in conversations_data.values())} conversation messages")
        print(f"\nLogin: demo / Demo1234")

    except Exception as e:
        conn.rollback()
        print(f"Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    seed_demo_data()
