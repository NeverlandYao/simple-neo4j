import pymysql
import os

# Load .env manually to be 100% sure
def _load_env(path=".env"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s=line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k,v=s.split("=",1)
                os.environ[k.strip()] = v.strip()
    except: pass

_load_env()

print(f"Connecting to: {os.environ.get('MYSQL_HOST')}@{os.environ.get('MYSQL_PORT')}")

try:
    conn = pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "localhost"),
        port=int(os.environ.get("MYSQL_PORT", 3306)),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DATABASE", "it_diathesis_system")
    )
    
    with conn.cursor() as cursor:
        # 1. Check current database name
        cursor.execute("SELECT DATABASE()")
        db_name = cursor.fetchone()
        print(f"Current Database: {db_name[0]}")
        
        # 2. Check connection ID and User
        cursor.execute("SELECT CONNECTION_ID(), CURRENT_USER(), @@hostname")
        res = cursor.fetchone()
        print(f"Connection ID: {res[0]}")
        print(f"Current User: {res[1]}")
        print(f"Server Hostname: {res[2]}")
        
    conn.close()
    print("\n✅ Verification Passed: Successfully connected to LOCAL MySQL.")

except Exception as e:
    print(f"\n❌ Verification Failed: {e}")
