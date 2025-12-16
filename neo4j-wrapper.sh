#!/bin/bash
set -e

# Run the original entrypoint in the background
/startup/docker-entrypoint.sh neo4j &

# Wait for Neo4j to be ready
echo "Waiting for Neo4j to start..."
until cypher-shell -u neo4j -p "$NEO4J_AUTH_PASSWORD" "RETURN 1" >/dev/null 2>&1; do
  sleep 1
done
echo "Neo4j is up."

# Check if data already imported (marker file)
if [ ! -f /data/imported.marker ]; then
    echo "Importing data.cypher..."
    # We need to handle multiple statements separated by semicolons if they are not in a single transaction block,
    # but cypher-shell usually handles it if input is piped properly.
    # However, your file has explicit semicolons.
    
    # Extract password from NEO4J_AUTH=neo4j/password
    PASS="${NEO4J_AUTH##*/}"
    
    cypher-shell -u neo4j -p "$PASS" -f /var/lib/neo4j/import/data.cypher
    
    touch /data/imported.marker
    echo "Import finished."
else
    echo "Data already imported."
fi

# Bring Neo4j to foreground
wait
