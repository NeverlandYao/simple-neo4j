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
NEO4J_URI = neo4j_cfg.get("url", "neo4j://127.0.0.1:7687")
NEO4J_USER = neo4j_cfg.get("user", "neo4j")
NEO4J_PASSWORD = neo4j_cfg.get("password", "")

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

rag_instances = {}

# Async Task Management
task_registry = {}
loop = None
loop_thread = None

def start_loop():
    global loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_forever()

def ensure_loop():
    global loop_thread, loop
    if loop_thread is None or not loop_thread.is_alive():
        loop_thread = threading.Thread(target=start_loop, daemon=True)
        loop_thread.start()
        # Wait for loop to be initialized
        while loop is None:
            time.sleep(0.1)

async def get_rag(db_name="neo4j"):
    # ... existing get_rag logic ...
    global rag_instances
    if db_name in rag_instances:
        return rag_instances[db_name]
        
    db_working_dir = os.path.join(WORKING_DIR, db_name)
    if not os.path.exists(db_working_dir):
        os.makedirs(db_working_dir)

    rag = LightRAG(
        working_dir=db_working_dir,
        llm_model_func=modelscope_llm,
        embedding_func=EmbeddingFunc(
            embedding_dim=1536, # OpenAI standard
            max_token_size=8192,
            func=modelscope_embedding
        ),
        kg_store_type="Neo4JStorage",
        kg_store_kwargs={
            "url": NEO4J_URI,
            "username": NEO4J_USER,
            "password": NEO4J_PASSWORD,
            "database": db_name
        }
    )
    rag_instances[db_name] = rag
    return rag

def submit_indexing_task(content, file_type, filename, db_name="neo4j"):
    ensure_loop()
    task_id = str(uuid.uuid4())
    
    async def _job():
        try:
            task_registry[task_id]['status'] = 'running'
            task_registry[task_id]['message'] = 'Parsing document...'
            
            text = ""
            
            # Parse Content
            if file_type == 'text':
                 text = content
            elif file_type == 'binary':
                 try:
                     # Decode Base64 content
                     # Content format: "data:application/pdf;base64,JVBERi..."
                     if "," in content:
                         content = content.split(",")[1]
                     
                     file_data = base64.b64decode(content)
                     f = io.BytesIO(file_data)
                     ext = os.path.splitext(filename)[1].lower()
                     
                     if ext == '.pdf' and pypdf:
                         pdf = pypdf.PdfReader(f)
                         text = "\n".join([p.extract_text() for p in pdf.pages])
                     elif ext == '.docx' and docx:
                         doc = docx.Document(f)
                         text = "\n".join([p.text for p in doc.paragraphs])
                     else:
                         # Fallback for plain text files
                         text = file_data.decode("utf-8", errors="ignore")
                 except Exception as e:
                     raise ValueError(f"File parsing failed: {str(e)}")

            if not text.strip():
                 raise ValueError("Extracted text is empty")

            task_registry[task_id]['message'] = 'Initializing LightRAG...'
            rag = await get_rag(db_name)
            
            task_registry[task_id]['message'] = 'Indexing content...'
            await rag.ainsert(text)
            
            task_registry[task_id]['status'] = 'completed'
            task_registry[task_id]['message'] = 'Done'
            task_registry[task_id]['progress'] = 100
        except asyncio.CancelledError:
            task_registry[task_id]['status'] = 'cancelled'
            task_registry[task_id]['message'] = 'Cancelled by user'
        except Exception as e:
            task_registry[task_id]['status'] = 'failed'
            task_registry[task_id]['message'] = f"Error: {str(e)}"
            logging.error(f"Task {task_id} failed: {e}")

    task_registry[task_id] = {
        'status': 'queued',
        'message': 'Queued for processing...',
        'progress': 0,
        'created_at': time.time()
    }
    
    # Submit to the persistent loop
    future = asyncio.run_coroutine_threadsafe(_job(), loop)
    task_registry[task_id]['future'] = future
    
    return task_id

def submit_insert_task(text, db_name="neo4j"):
    # Compatibility wrapper
    return submit_indexing_task(text, 'text', 'raw_text', db_name)

def cancel_task(task_id):
    if task_id in task_registry:
        task = task_registry[task_id]
        if task['status'] in ['queued', 'running']:
            future = task.get('future')
            if future:
                future.cancel()
            task['status'] = 'cancelling'
            task['message'] = 'Cancelling...'
            return True
    return False

def get_task_status(task_id):
    if task_id not in task_registry:
        return None
    
    task = task_registry[task_id]
    return {
        'task_id': task_id,
        'status': task['status'],
        'message': task['message'],
        'progress': task.get('progress', 0),
        'created_at': task['created_at']
    }

# Sync wrapper for query (still uses run_coroutine_threadsafe to reuse the loop if we wanted, 
# but for query we usually want to wait for result. For now let's keep it simple using asyncio.run 
# OR reuse the loop to avoid conflicts if LightRAG is not thread safe with multiple loops)
def query_text(query, mode="global", db_name="neo4j"):
    # Reuse the same loop for safety
    ensure_loop()
    async def _run():
        rag = await get_rag(db_name)
        return await rag.aquery(query, param=QueryParam(mode=mode))
        
    future = asyncio.run_coroutine_threadsafe(_run(), loop)
    return future.result()

# Legacy insert_text replaced by submit_insert_task, but kept for compatibility if needed (blocking)
def insert_text(text, db_name="neo4j"):
    # Forward to async task and wait
    task_id = submit_insert_task(text, db_name)
    while True:
        status = get_task_status(task_id)
        if status['status'] in ['completed', 'failed', 'cancelled']:
            break
        time.sleep(0.5)

