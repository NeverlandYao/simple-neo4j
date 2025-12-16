#!/bin/bash

# Debug: Check if frontend files exist
echo "Checking frontend files in /usr/share/nginx/html:"
ls -la /usr/share/nginx/html

# Generate neo4j-link.txt from environment variables if they exist
if [ ! -z "$NEO4J_URI" ]; then
    echo "Generating neo4j-link.txt from environment variables..."
    echo "url=$NEO4J_URI" > /usr/share/nginx/html/neo4j-link.txt
    if [ ! -z "$NEO4J_USER" ]; then
        echo "user=$NEO4J_USER" >> /usr/share/nginx/html/neo4j-link.txt
    fi
    if [ ! -z "$NEO4J_PASSWORD" ]; then
        echo "password=$NEO4J_PASSWORD" >> /usr/share/nginx/html/neo4j-link.txt
    fi
    if [ ! -z "$NEO4J_DATABASE" ]; then
        echo "database=$NEO4J_DATABASE" >> /usr/share/nginx/html/neo4j-link.txt
    fi
    # Copy to app dir for backend fallback (optional)
    cp /usr/share/nginx/html/neo4j-link.txt /app/neo4j-link.txt
else
    # If no ENV, check if neo4j-link.txt exists in root (from build) and move it
    if [ -f "/app/neo4j-link.txt" ]; then
        cp /app/neo4j-link.txt /usr/share/nginx/html/neo4j-link.txt
    fi
fi

# Start Backend
echo "Starting Python Backend on port 8001..."
cd /app
export LLM_PORT=8001
# 2>&1 | tee /var/log/backend.log & to see logs in docker logs
python3 api_llm.py > /dev/stdout 2>&1 &

# Start Nginx
echo "Starting Nginx..."
nginx -g "daemon off;"
