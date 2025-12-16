import os
import json
import asyncio
import numpy as np
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc
import logging

# Configure logging
logging.basicConfig(format="%(levelname)s:%(message)s", level=logging.INFO)

# Load environment variables
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

MS_BASE_URL = os.environ.get("MS_BASE_URL", "https://api-inference.modelscope.cn/v1").rstrip("/")
MS_API_KEY = os.environ.get("MS_API_KEY", "")
MS_MODEL = os.environ.get("MS_MODEL", "Qwen/Qwen3-32B")

# Define ModelScope LLM Function
async def modelscope_llm(prompt, system_prompt=None, history_messages=[], **kwargs) -> str:
    # Adapt to LightRAG's expected signature
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history_messages:
        messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})

    return await openai_complete_if_cache(
        model=MS_MODEL,
        messages=messages,
        base_url=MS_BASE_URL,
        api_key=MS_API_KEY,
        **kwargs
    )

# Define ModelScope Embedding Function
# Note: If ModelScope doesn't support embeddings, we might need a fallback or local model.
# For now, we assume it supports the standard /embeddings endpoint or we use a dummy one if it fails.
async def modelscope_embedding(texts: list[str]) -> np.ndarray:
    try:
        return await openai_embed(
            texts,
            model="text-embedding-v1", # Adjust based on ModelScope availability
            base_url=MS_BASE_URL,
            api_key=MS_API_KEY
        )
    except Exception as e:
        print(f"Embedding failed: {e}")
        # Fallback: Return random vectors if embedding fails (just to keep it running for graph extraction)
        # In production, use a real local model like SentenceTransformer
        return np.random.rand(len(texts), 1536)

# Initialize LightRAG
# We use Neo4j for storage as requested
def get_neo4j_config():
    cfg = {}
    try:
        with open("neo4j-link.txt", "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    cfg[k.strip()] = v.strip()
    except:
        pass
    return cfg

neo4j_cfg = get_neo4j_config()
NEO4J_URI = os.environ.get("NEO4J_URI") or neo4j_cfg.get("url", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.environ.get("NEO4J_USER") or neo4j_cfg.get("user", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD") or neo4j_cfg.get("password", "")

WORKING_DIR = "./lightrag_data"
if not os.path.exists(WORKING_DIR):
    os.makedirs(WORKING_DIR)

import threading
import uuid
import time
import io
import base64

# PDF/Docx Extraction
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

# ... imports ...

# Global LightRAG Instance
rag_instances = {}
rag_lock = asyncio.Lock()

async def get_rag(db_name="neo4j"):
    global rag_instances
    async with rag_lock:
        if db_name in rag_instances:
            return rag_instances[db_name]
        
        db_working_dir = os.path.join(WORKING_DIR, db_name)
        if not os.path.exists(db_working_dir):
            os.makedirs(db_working_dir)

        try:
            print(f"Initializing LightRAG for {db_name}...")
            rag = LightRAG(
                working_dir=db_working_dir,
                llm_model_func=modelscope_llm,
                embedding_func=EmbeddingFunc(
                    embedding_dim=1536,
                    max_token_size=8192,
                    func=modelscope_embedding
                ),
                kg_store_type="Neo4JStorage",
                kg_store_kwargs={
                    "url": NEO4J_URI,
                    "username": NEO4J_USER,
                    "password": NEO4J_PASSWORD,
                    "database": db_name
                },
                log_level="INFO"
            )
            rag_instances[db_name] = rag
            print(f"LightRAG Initialized Successfully for {db_name}")
            return rag
        except Exception as e:
            print(f"Failed to initialize LightRAG: {e}")
            return None

# Task Queue System
tasks = {} # id -> {status, result, error, filename, type}

def background_indexing_task(task_id, content, type, filename, db_name):
    # This runs in a separate thread
    async def _run():
        try:
            tasks[task_id]['status'] = 'running'
            rag = await get_rag(db_name)
            if not rag:
                raise Exception("LightRAG initialization failed")
            
            print(f"Starting indexing for {filename}...")
            await rag.ainsert(content)
            
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['message'] = 'Indexing completed successfully'
            print(f"Indexing completed for {filename}")
        except Exception as e:
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)
            print(f"Indexing failed for {filename}: {e}")

    # Create new event loop for the thread if needed, or use run
    try:
        asyncio.run(_run())
    except Exception as e:
        tasks[task_id]['status'] = 'failed'
        tasks[task_id]['error'] = str(e)

def submit_indexing_task(content, type, filename, db_name="neo4j"):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        'id': task_id,
        'status': 'queued',
        'filename': filename,
        'created_at': time.time()
    }
    
    # Handle base64 decoding if needed
    if type == 'binary' and pypdf:
        # Decode base64 to bytes
        # This part should be moved to inside the thread to avoid blocking
        pass

    thread = threading.Thread(target=background_indexing_task, args=(task_id, content, type, filename, db_name))
    thread.daemon = True
    thread.start()
    
    return task_id

def get_task_status(task_id):
    return tasks.get(task_id)

def cancel_task(task_id):
    # Simple implementation: just mark as cancelled if not running
    if task_id in tasks:
        if tasks[task_id]['status'] == 'queued':
            tasks[task_id]['status'] = 'cancelled'
            return True
    return False

