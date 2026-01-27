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
        
        # Data for Demo Junior
        birth_year = 2000
        birth_date = f"{birth_year}-05-15"
        retire_year = birth_year + 65
        retire_date = f"{retire_year}-05-15"
        
        junior_data = {
            "profile_name": "Junior Employee - Alex",
            "person": {
                "name": "Alex Junior",
                "birth_date": birth_date,
                "retirement_date": retire_date,
                "life_expectancy": 95,
                "current_age": datetime.now().year - birth_year,
                "retirement_age": 65
            },
            "spouse": {}, 
            "children": [],
            "financial": {
                "annual_income": 70000,
                "annual_expenses": 48000, 
                "liquid_assets": 12500,
                "retirement_assets": 15000,
                "social_security_benefit": 2200, 
                "annual_ira_contribution": 6000
            },
            "income_streams": [
                {
                    "name": "Salary (Junior Dev)",
                    "type": "salary",
                    "amount": 70000,
                    "frequency": "annual",
                    "start_date": datetime.now().strftime("%Y-%m-%d"),
                    "end_date": retire_date,
                    "inflation_adjusted": True,
                    "growth_rate": 0.03
                }
            ],
            "budget": {
                "income": {
                    "current": {
                        "employment": { "primary_person": 70000, "spouse": 0 }
                    }
                },
                "expenses": {
                    "current": {
                        "housing": { "amount": 1800, "frequency": "monthly" },
                        "utilities": { "amount": 200, "frequency": "monthly" },
                        "food": { "amount": 600, "frequency": "monthly" },
                        "transportation": { "amount": 400, "frequency": "monthly" },
                        "entertainment": { "amount": 300, "frequency": "monthly" },
                        "other": { "amount": 700, "frequency": "monthly" }
                    }
                }
            },
            "assets": {
                "taxable_accounts": [
                    { "name": "Checking Account", "type": "checking", "value": 2500, "cost_basis": 2500 },
                    { "name": "Emergency Fund", "type": "savings", "value": 10000, "cost_basis": 10000 }
                ],
                "retirement_accounts": [
                    { "name": "401k - Tech Corp", "type": "401k", "value": 15000, "cost_basis": 12000 },
                    { "name": "Roth IRA", "type": "roth_ira", "value": 5000, "cost_basis": 4000 }
                ]
            },
            "market_assumptions": { "stock_allocation": 0.90, "stock_return_mean": 0.10, "inflation_mean": 0.03 }
        }

        profiles = [
            {
                "name": "Demo Junior",
                "data": junior_data
            },
            {
                "name": "Demo Thompson",
                "data": {
                    "profile_name": "Demo Thompson",
                    "person": {
                        "name": "Tom Thompson",
                        "birth_date": "1980-06-15",
                        "retirement_date": "2045-06-15",
                        "life_expectancy": 90,
                        "current_age": 45,
                        "retirement_age": 65
                    },
                    "spouse": {
                        "name": "Tara Thompson",
                        "birth_date": "1982-08-20",
                        "retirement_date": "2047-08-20"
                    },
                    "children": [{"name": "Timmy", "age": 10}, {"name": "Tammy", "age": 8}],
                    "financial": {
                        "annual_income": 150000,
                        "annual_expenses": 100000,
                        "liquid_assets": 50000,
                        "retirement_assets": 400000,
                        "social_security_benefit": 3500,
                        "annual_ira_contribution": 12000
                    },
                    "assets": {
                        "taxable_accounts": [{"name": "Joint Brokerage", "value": 50000, "type": "brokerage"}],
                        "retirement_accounts": [
                            {"name": "Tom 401k", "value": 250000, "type": "401k"},
                            {"name": "Tara 401k", "value": 150000, "type": "401k"}
                        ],
                        "real_estate": [{"name": "Primary Home", "value": 600000, "mortgage": 350000}]
                    },
                    "market_assumptions": {"stock_allocation": 0.70, "stock_return_mean": 0.08, "inflation_mean": 0.03}
                }
            },
            {
                "name": "Demo Starman",
                "data": {
                    "profile_name": "Demo Starman",
                    "person": {
                        "name": "Stella Starman",
                        "birth_date": "1990-03-10",
                        "retirement_date": "2040-03-10",
                        "life_expectancy": 95,
                        "current_age": 35,
                        "retirement_age": 50
                    },
                    "spouse": {},
                    "children": [],
                    "financial": {
                        "annual_income": 200000,
                        "annual_expenses": 60000,
                        "liquid_assets": 150000,
                        "retirement_assets": 300000,
                        "social_security_benefit": 2800,
                        "annual_ira_contribution": 7000
                    },
                    "assets": {
                        "taxable_accounts": [{"name": "High Yield Savings", "value": 50000, "type": "savings"}, {"name": "Vanguard Index", "value": 100000, "type": "brokerage"}],
                        "retirement_accounts": [{"name": "Tech 401k", "value": 300000, "type": "401k"}],
                        "real_estate": []
                    },
                    "market_assumptions": {"stock_allocation": 0.90, "stock_return_mean": 0.09, "inflation_mean": 0.03}
                }
            },
            {
                "name": "Demo Dudeman",
                "data": {
                    "profile_name": "Demo Dudeman",
                    "person": {
                        "name": "The Dude",
                        "birth_date": "1975-11-05",
                        "retirement_date": "2035-11-05",
                        "life_expectancy": 85,
                        "current_age": 50,
                        "retirement_age": 60
                    },
                    "spouse": {},
                    "children": [],
                    "financial": {
                        "annual_income": 60000,
                        "annual_expenses": 30000,
                        "liquid_assets": 20000,
                        "retirement_assets": 150000,
                        "social_security_benefit": 1800,
                        "annual_ira_contribution": 0
                    },
                    "assets": {
                        "taxable_accounts": [{"name": "Checking", "value": 5000, "type": "checking"}, {"name": "CDs", "value": 15000, "type": "cd"}],
                        "retirement_accounts": [{"name": "Old IRA", "value": 150000, "type": "traditional_ira"}],
                        "real_estate": [{"name": "Bungalow", "value": 250000, "mortgage": 0}]
                    },
                    "market_assumptions": {"stock_allocation": 0.50, "stock_return_mean": 0.07, "inflation_mean": 0.03}
                }
            }
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
