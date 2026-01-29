#!/usr/bin/env python3
"""
Seed the database with the full set of Demo profiles.
Replaces the existing 'demo' user data with:
1. Demo Junior (Alex - Junior Employee)
2. Demo Thompson (Tom & Tara - Family/Mid-Career)
3. Demo Starman (Stella - FIRE/High Earner)
4. Demo Dudeman (The Dude - Coasting)
"""

import sys
import os
import sqlite3
import json
import base64
import bcrypt
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services.encryption_service import EncryptionService

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
        # 1. Setup Demo User & Keys
        username = 'demo'
        email = 'demo@example.com'
        password = 'Demo1234'
        
        # Generate Salt & Hash Password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Generate User Keys
        from cryptography.hazmat.primitives import hashes
        digest = hashes.Hash(hashes.SHA256())
        digest.update(username.encode('utf-8'))
        digest.update(email.encode('utf-8'))
        kek_salt = digest.finalize()
        
        # Generate DEK
        dek = EncryptionService.generate_dek()
        
        # Encrypt DEK with KEK (derived from password)
        kek = EncryptionService.get_kek_from_password(password, kek_salt)
        enc_service = EncryptionService(key=kek)
        dek_b64 = base64.b64encode(dek).decode('utf-8')
        encrypted_dek, dek_iv = enc_service.encrypt(dek_b64)

        # Upsert User
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        existing_user = cursor.fetchone()
        
        user_id = None
        if existing_user:
            user_id = existing_user['id']
            print(f"✓ Updating existing user '{username}' (ID: {user_id})")
            cursor.execute("""
                UPDATE users 
                SET password_hash = ?, encrypted_dek = ?, dek_iv = ?, updated_at = ?
                WHERE id = ?
            """, (password_hash, encrypted_dek, dek_iv, datetime.now().isoformat(), user_id))
        else:
            print(f"✓ Creating new user '{username}'")
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, is_active, is_admin, 
                                 encrypted_dek, dek_iv, created_at, updated_at)
                VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?)
            """, (username, email, password_hash, encrypted_dek, dek_iv, 
                  datetime.now().isoformat(), datetime.now().isoformat()))
            user_id = cursor.lastrowid

        # Profile Encryption Service
        profile_enc_service = EncryptionService(key=dek)

        # 2. Define Profiles
        
        # Current date for calculations
        today = datetime.now().strftime("%Y-%m-%d")

        # ============================================
        # DEMO JUNIOR - Entry Level Developer, 26yo
        # ============================================
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
                {"name": "Software Developer Salary", "amount": 5833, "source": "employment", "start_date": "2022-06-01", "end_date": None}
            ],
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [{"name": "Rent (1BR Apartment)", "amount": 1650, "frequency": "monthly"}],
                        "utilities": [
                            {"name": "Electric/Gas", "amount": 85, "frequency": "monthly"},
                            {"name": "Internet", "amount": 65, "frequency": "monthly"},
                            {"name": "Phone", "amount": 45, "frequency": "monthly"}
                        ],
                        "food": [
                            {"name": "Groceries", "amount": 350, "frequency": "monthly"},
                            {"name": "Dining Out", "amount": 200, "frequency": "monthly"}
                        ],
                        "transportation": [
                            {"name": "Car Payment", "amount": 350, "frequency": "monthly"},
                            {"name": "Gas", "amount": 120, "frequency": "monthly"},
                            {"name": "Car Insurance", "amount": 95, "frequency": "monthly"}
                        ],
                        "insurance": [{"name": "Renters Insurance", "amount": 25, "frequency": "monthly"}],
                        "entertainment": [
                            {"name": "Streaming Services", "amount": 45, "frequency": "monthly"},
                            {"name": "Gaming/Hobbies", "amount": 75, "frequency": "monthly"}
                        ],
                        "personal": [
                            {"name": "Gym Membership", "amount": 40, "frequency": "monthly"},
                            {"name": "Personal Care", "amount": 50, "frequency": "monthly"}
                        ],
                        "other": [{"name": "Miscellaneous", "amount": 150, "frequency": "monthly"}]
                    },
                    "future": {
                        "housing": [{"name": "Rent (Adjusted)", "amount": 1200, "frequency": "monthly"}],
                        "utilities": [{"name": "Utilities", "amount": 150, "frequency": "monthly"}],
                        "food": [{"name": "Food", "amount": 400, "frequency": "monthly"}],
                        "healthcare": [{"name": "Medicare + Supplement", "amount": 350, "frequency": "monthly"}],
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

        # ============================================
        # DEMO THOMPSON - Upper-Middle Class Family, Bay Area
        # ============================================
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
                {"name": "Tom - Senior Engineer (FAANG)", "amount": 18500, "source": "employment", "start_date": "2015-01-15", "end_date": None},
                {"name": "Tara - Product Manager", "amount": 13500, "source": "employment", "start_date": "2016-03-01", "end_date": None},
                {"name": "RSU Vesting (Annual)", "amount": 2500, "source": "investment", "start_date": "2020-01-01", "end_date": None}
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
                            {"name": "Groceries (Whole Foods)", "amount": 1200, "frequency": "monthly"},
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
                            {"name": "Streaming/Subscriptions", "amount": 100, "frequency": "monthly"},
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

        # ============================================
        # DEMO STARMAN - Middle Class Family, Austin TX
        # ============================================
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
                {"name": "Steve - IT Manager", "amount": 9200, "source": "employment", "start_date": "2018-06-01", "end_date": None},
                {"name": "Sarah - Nurse (Part-Time)", "amount": 4500, "source": "employment", "start_date": "2020-01-15", "end_date": None}
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

        # ============================================
        # DEMO DUDEMAN - Blue Collar, IBEW Electrician
        # ============================================
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
                {"name": "IBEW Electrician", "amount": 6100, "source": "employment", "start_date": "2005-03-15", "end_date": None}
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

        # 3. Wipe and Recreate Profiles
        print("✓ Removing existing demo profiles...")
        cursor.execute("DELETE FROM profile WHERE user_id = ?", (user_id,))

        for p in profiles:
            print(f"  - Creating profile: {p['name']}")
            encrypted_data, data_iv = profile_enc_service.encrypt_dict(p['data'])
            
            cursor.execute("""
                INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                p['name'],
                p['data']['person']['birth_date'],
                p['data']['person']['retirement_date'],
                encrypted_data,
                data_iv,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))

        conn.commit()
        print(f"✅ Successfully seeded {len(profiles)} demo profiles.")
        print("Login: demo / Demo1234")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    seed_demo_data()
