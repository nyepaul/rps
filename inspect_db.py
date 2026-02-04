
import sqlite3
import json
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

# Configuration (from src/config.py or environment)
# I need to find where the encryption key is derived from or stored.
# The user table has 'encrypted_dek', 'dek_iv'. This implies a master key or password derivation.
# Accessing encrypted data without the user's password or master key is hard/impossible by design.
# However, I am the system. Let's check src/services/encryption_service.py to see if there's a master key or test mode.

# If I cannot decrypt, I can't see the data.
# But wait, the user is reporting a bug in "account Paul profile G".
# If this is a local dev environment, maybe I can find the password in a seed script or test.
# Or maybe the data in 'profile' table 'data' column is just JSON if encryption is disabled?
# The schema shows 'data_iv', which suggests encryption.

def inspect_profile():
    conn = sqlite3.connect('data/planning.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Find user Paul
    cursor.execute("SELECT id, username FROM users WHERE username LIKE '%Paul%'")
    users = cursor.fetchall()
    print(f"Users found: {[dict(u) for u in users]}")
    
    if not users:
        print("User Paul not found.")
        return

    user_id = users[0]['id']
    
    # Find profile G
    cursor.execute("SELECT id, name, data, data_iv FROM profile WHERE user_id = ? AND name = 'G'", (user_id,))
    profile = cursor.fetchone()
    
    if not profile:
        print("Profile G not found.")
        # List all profiles for Paul
        cursor.execute("SELECT name FROM profile WHERE user_id = ?", (user_id,))
        profiles = cursor.fetchall()
        print(f"Available profiles for Paul: {[p['name'] for p in profiles]}")
        return

    print(f"Found Profile G: ID={profile['id']}")
    print(f"Data length: {len(profile['data']) if profile['data'] else 0}")
    print(f"Data IV: {profile['data_iv']}")
    
    # Check if data looks like JSON (starts with {)
    data_str = profile['data']
    if data_str.strip().startswith('{'):
        print("Data appears to be unencrypted JSON:")
        print(data_str[:500] + "...")
    else:
        print("Data appears to be encrypted.")

if __name__ == '__main__':
    inspect_profile()
