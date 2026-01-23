#!/usr/bin/env python3
"""
Seed the database with a 'Junior Employee' demo profile.
Replaces the existing 'demo' user data with a new persona:
- Name: Alex Junior
- Role: Junior Employee
- Income: $70k/year
- Assets: Modest starter portfolio
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

def seed_junior_employee():
    print(f"Seeding Junior Employee profile into: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Setup Demo User
        username = 'demo'
        email = 'demo@example.com'
        password = 'demo'
        
        # Generate Salt & Hash Password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Generate User Keys
        # Deterministic salt for KEK (simulating User.get_kek_salt)
        # Note: In app this is a hash of username+email. Replicating simple logic here.
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
            print(f"Updating existing user '{username}' (ID: {user_id})")
            cursor.execute("""
                UPDATE users 
                SET password_hash = ?, encrypted_dek = ?, dek_iv = ?, updated_at = ?
                WHERE id = ?
            """, (password_hash, encrypted_dek, dek_iv, datetime.now().isoformat(), user_id))
        else:
            print(f"Creating new user '{username}'")
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, is_active, is_admin, 
                                 encrypted_dek, dek_iv, created_at, updated_at)
                VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?)
            """, (username, email, password_hash, encrypted_dek, dek_iv, 
                  datetime.now().isoformat(), datetime.now().isoformat()))
            user_id = cursor.lastrowid

        # 2. Prepare Profile Data (Junior Employee)
        # Born 2000 (approx 26 years old)
        birth_year = 2000
        birth_date = f"{birth_year}-05-15"
        # Retire at 65
        retire_year = birth_year + 65
        retire_date = f"{retire_year}-05-15"
        
        profile_data = {
            "profile_name": "Junior Employee - Alex",
            "person": {
                "name": "Alex Junior",
                "birth_date": birth_date,
                "retirement_date": retire_date,
                "life_expectancy": 95,
                "current_age": datetime.now().year - birth_year,
                "retirement_age": 65
            },
            # Single profile for now
            "spouse": {}, 
            "children": [],
            "financial": {
                "annual_income": 70000,
                "annual_expenses": 48000, # $4k/mo
                "liquid_assets": 12500,
                "retirement_assets": 15000,
                "social_security_benefit": 2200, # Est future dollars
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
                    "growth_rate": 0.03 # Salary growth
                }
            ],
            "budget": {
                "income": {
                    "current": {
                        "employment": {
                            "primary_person": 70000,
                            "spouse": 0
                        }
                    }
                },
                "expenses": {
                    "current": {
                        "housing": { "amount": 1800, "frequency": "monthly" }, # Rent
                        "utilities": { "amount": 200, "frequency": "monthly" },
                        "food": { "amount": 600, "frequency": "monthly" },
                        "transportation": { "amount": 400, "frequency": "monthly" },
                        "entertainment": { "amount": 300, "frequency": "monthly" },
                        "other": { "amount": 700, "frequency": "monthly" } # Student loans etc
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
            "market_assumptions": {
                "stock_allocation": 0.90, # Young = aggressive
                "stock_return_mean": 0.10,
                "inflation_mean": 0.03
            }
        }

        # 3. Encrypt Profile Data
        # Use the raw DEK to encrypt the profile blob
        profile_enc_service = EncryptionService(key=dek)
        encrypted_data, data_iv = profile_enc_service.encrypt_dict(profile_data)

        # 4. Save Profile
        # Delete old profiles for this user first to be clean
        cursor.execute("DELETE FROM profile WHERE user_id = ?", (user_id,))
        
        print("Creating new profile...")
        cursor.execute("""
            INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, 
            "Demo Junior", 
            birth_date, 
            retire_date, 
            encrypted_data, 
            data_iv, 
            datetime.now().isoformat(), 
            datetime.now().isoformat()
        ))
        
        conn.commit()
        print("✅ Successfully seeded 'Demo Junior' profile.")
        print("Login: demo / demo")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    seed_junior_employee()
