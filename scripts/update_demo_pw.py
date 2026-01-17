import sqlite3
import bcrypt
import os

db_path = '/var/www/rps.pan2.app/data/planning.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

username = 'demo'
password = '***REMOVED***'
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (password_hash, username))
conn.commit()
conn.close()
print("Updated password for demo")
