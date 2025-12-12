import neo4j from 'neo4j-driver';

export async function loadConfig(){
  const res=await fetch('/neo4j-link.txt');
  const text=await res.text();
  const out={};
  text.split(/\r?\n/).forEach(line=>{
    const i=line.indexOf('=');
    if(i>0){ const k=line.slice(0,i).trim(); const v=line.slice(i+1).trim(); if(k) out[k]=v; }
  });
  return out;
}

export async function detectLocalLlm(){
  const ports=[3000,5000,8001,8080,8888];
  for(const p of ports){
    const url=`http://127.0.0.1:${p}/llm`;
    try{ const r=await fetch(url,{method:'OPTIONS'}); if(r.ok) return url; }catch(_){ }
  }
  return '';
}

export async function getSession(dbName = null) {
  const cfg = await loadConfig();
  const driver = neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user || 'neo4j', cfg.password));
  const session = driver.session({ database: dbName || cfg.database });
  return { session, driver, config: cfg };
}

export async function getDatabases() {
  const cfg = await loadConfig();
  const driver = neo4j.driver(cfg.url, neo4j.auth.basic(cfg.user || 'neo4j', cfg.password));
  const session = driver.session({ database: 'system' });
  try {
    const result = await session.run("SHOW DATABASES");
    return result.records.map(r => r.get('name'));
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function getDatabaseLabels(dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    const result = await session.run("CALL db.labels()");
    return result.records.map(r => r.get('label'));
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function getDatabaseRelationshipTypes(dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    const result = await session.run("CALL db.relationshipTypes()");
    return result.records.map(r => r.get('relationshipType'));
  } finally {
    await session.close();
    await driver.close();
  }
}

// --- CRUD Operations ---

export async function createNode(label, properties, dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    const result = await session.run(
      `CREATE (n:${label}) SET n += $props RETURN n`,
      { props: properties }
    );
    return result.records[0].get('n');
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function deleteNode(id, dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    await session.run(
      `MATCH (n) WHERE elementId(n) = $id OR id(n) = $legacyId DETACH DELETE n`,
      { id, legacyId: parseInt(id) || -1 }
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function updateNode(id, properties, dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    const result = await session.run(
      `MATCH (n) WHERE elementId(n) = $id OR id(n) = $legacyId SET n += $props RETURN n`,
      { id, legacyId: parseInt(id) || -1, props: properties }
    );
    return result.records[0].get('n');
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function createRelation(fromId, toId, type, dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    // Sanitize type to avoid Cypher injection and handle spaces
    const safeType = type.replace(/[^a-zA-Z0-9_]/g, "_");
    
    const result = await session.run(
      `
      MATCH (a), (b)
      WHERE (elementId(a) = $fromId OR id(a) = $legacyFromId)
        AND (elementId(b) = $toId OR id(b) = $legacyToId)
      CREATE (a)-[r:\`${safeType}\`]->(b)
      RETURN r
      `,
      { 
        fromId, legacyFromId: parseInt(fromId) || -1,
        toId, legacyToId: parseInt(toId) || -1
      }
    );
    return result.records[0].get('r');
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function searchGraph(keywords, dbName) {
  const { session, driver } = await getSession(dbName);
  try {
    // Basic fuzzy search on common text properties
    // We search for nodes where name, content, or description contains ANY of the keywords
    // For a better implementation, one would use Fulltext Indexes.
    
    // Construct a dynamic OR clause for keywords
    // Note: This is a simple implementation. 
    // Ideally, we should pass keywords as a parameter list and use ANY/NONE functions, 
    // but Neo4j string matching is case-sensitive by default unless configured otherwise or using toLower.
    
    const result = await session.run(`
      WITH $keywords as terms
      MATCH (n)
      WHERE ANY(term IN terms WHERE 
        toLower(n.name) CONTAINS toLower(term) OR 
        toLower(n.content) CONTAINS toLower(term) OR 
        toLower(n.description) CONTAINS toLower(term) OR
        toLower(n.title) CONTAINS toLower(term)
      )
      // Return node and its immediate 1-hop neighborhood
      WITH n LIMIT 5
      OPTIONAL MATCH (n)-[r]-(m)
      RETURN n, collect({rel: type(r), node: m, dir: startNode(r) = n}) as neighbors
    `, { keywords });

    return result.records.map(record => {
      const node = record.get('n');
      const neighbors = record.get('neighbors');
      
      const props = node.properties || {};
      const focus = props.name || props.content || props.title || "Unknown Node";
      
      // Format neighbors for the LLM
      const links = neighbors.map(nb => {
        const otherNode = nb.node;
        const otherProps = otherNode.properties || {};
        return {
          neighborName: otherProps.name || otherProps.content || otherProps.title || "Unknown",
          neighborId: otherNode.elementId || String(otherNode.identity),
          type: nb.rel,
          dir: nb.dir ? '->' : '<-'
        };
      });

      return {
        focus,
        links,
        // Helper lists for specific types if needed, but 'links' covers it all generally
        neighbors: links.map(l => l.neighborName),
        relations: links.map(l => l.type)
      };
    });
  } catch(err) {
      console.error("Search failed:", err);
      return [];
  } finally {
    await session.close();
    await driver.close();
  }
}

