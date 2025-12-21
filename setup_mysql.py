import pymysql
import sys
import os

def _load_env(path=".env"):
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s=line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k,v=s.split("=",1)
                k=k.strip()
                v=v.strip()
                if k and v and k not in os.environ:
                    os.environ[k]=v
    except FileNotFoundError:
        pass

_load_env()
# MySQL Config from env
DB_HOST = os.environ.get("MYSQL_HOST", "localhost")
DB_PORT = int(os.environ.get("MYSQL_PORT", 3306))
DB_USER = os.environ.get("MYSQL_USER", "root")
DB_PASSWORD = os.environ.get("MYSQL_PASSWORD", "123456")

def setup_database():
    print(f"Connecting to MySQL at {DB_HOST}:{DB_PORT} as {DB_USER}...")
    try:
        # Connect without selecting a database first
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        # Read SQL file
        with open('schema.sql', 'r') as f:
            sql_script = f.read()
            
        # Split into statements (simple split by ;)
        statements = [s.strip() for s in sql_script.split(';') if s.strip()]
        
        print(f"Found {len(statements)} SQL statements to execute.")
        
        for i, stmt in enumerate(statements):
            print(f"Executing statement {i+1}...")
            try:
                cursor.execute(stmt)
            except Exception as e:
                print(f"Error executing statement: {stmt[:50]}...")
                print(f"Error details: {e}")
                
        conn.commit()
        conn.close()
        print("Database setup completed successfully.")
        
        # Verify
        verify_tables()
        
    except Exception as e:
        print(f"Critical Error: {e}")
        sys.exit(1)

def verify_tables():
    print("\nVerifying tables...")
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database="it_diathesis_system"
        )
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print("Tables in 'it_diathesis_system':")
        for table in tables:
            print(f"- {table[0]}")
        conn.close()
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    setup_database()
