
import sqlite3
import json
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))

from src.database import connection
from src.auth.models import User
from src.models.profile import Profile
from src.services.encryption_service import decrypt_dict

def migrate_api_keys():
    print("Starting API key migration from profiles to user accounts...")
    
    # Get all users
    users_rows = connection.db.execute("SELECT id, username FROM users")
    
    for u_row in users_rows:
        user_id = u_row['id']
        username = u_row['username']
        
        # Find all profiles for this user
        profiles = connection.db.execute("SELECT id, name, data, data_iv FROM profile WHERE user_id = ?", (user_id,))
        
        user_api_keys = {}
        found_keys = False
        
        # We'll collect keys from all profiles, newer profiles overwrite older ones if there's a conflict
        # But usually they should be the same.
        for p_row in profiles:
            p_data = p_row['data']
            p_iv = p_row['data_iv']
            
            if not p_data or not p_iv:
                continue
                
            try:
                # Decrypt profile data
                # We need a context where session['user_dek'] might be needed, 
                # but for a CLI script we might need to handle this differently if DEK is required.
                # However, Profile.data_dict handles decryption if it can.
                p = Profile(id=p_row['id'], user_id=user_id, data=p_data, data_iv=p_iv)
                data_dict = p.data_dict
                
                if 'api_keys' in data_dict:
                    api_keys = data_dict['api_keys']
                    if api_keys:
                        print(f"  Found keys in profile '{p_row['name']}' for user '{username}'")
                        user_api_keys.update(api_keys)
                        found_keys = True
                        
                        # Remove keys from profile data
                        del data_dict['api_keys']
                        p.data_dict = data_dict
                        p.save()
                        print(f"    Removed keys from profile '{p_row['name']}'")
            except Exception as e:
                print(f"  Error processing profile {p_row['id']}: {e}")
        
        if found_keys:
            # Save keys to user account
            user = User.get_by_id(user_id)
            if user:
                # Merge with any existing user keys (unlikely at this stage)
                existing_keys = user.api_keys_dict
                existing_keys.update(user_api_keys)
                user.api_keys_dict = existing_keys
                user.save()
                print(f"  ✓ Successfully moved API keys to account layer for user '{username}'")

    print("Migration complete.")

if __name__ == "__main__":
    migrate_api_keys()
