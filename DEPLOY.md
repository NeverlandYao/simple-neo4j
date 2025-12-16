# Deployment Guide

This guide describes how to deploy the application to a production environment (e.g., a Linux server).

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Neo4j Database** (Local or AuraDB)
- **Nginx** (or any other web server)

## 1. Backend Setup

The backend is a Python script (`api_llm.py`) that handles LLM requests and file processing.

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory (if not exists) and configure your keys:
    ```env
    MS_API_KEY=your_modelscope_api_key
    # Optional:
    MS_MODEL=Qwen/Qwen3-32B
    ```

3.  **Run the Server**:
    Use `nohup` or a process manager like `supervisor` or `systemd` to keep it running.
    ```bash
    # Runs on port 8001 by default
    nohup python api_llm.py > backend.log 2>&1 &
    ```

## 2. Frontend Setup

The frontend is a React application built with Vite.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Build**:
    ```bash
    npm run build
    ```
    This will generate a `dist/` directory containing static files.

3.  **Neo4j Configuration**:
    The frontend needs to know how to connect to Neo4j.
    Ensure `public/neo4j-link.txt` exists and has the correct production credentials.
    ```txt
    url=neo4j://your-neo4j-host:7687
    user=neo4j
    password=your-password
    database=neo4j
    ```
    (Note: If using Neo4j Aura, use `neo4j+s://...`)

## 3. Nginx Configuration

Since the frontend expects API endpoints at `/llm`, `/task_status`, etc., you need a reverse proxy to route these requests to the backend.

Example Nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/your/project/dist;
    index index.html;

    # Serve Static Files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Python Backend
    location /llm {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /question {
        proxy_pass http://127.0.0.1:8001;
    }

    location /question_stats {
        proxy_pass http://127.0.0.1:8001;
    }

    location /submit_answer {
        proxy_pass http://127.0.0.1:8001;
    }

    location /health {
        proxy_pass http://127.0.0.1:8001;
    }

    location /upload_doc {
        proxy_pass http://127.0.0.1:8001;
    }

    location /task_status {
        proxy_pass http://127.0.0.1:8001;
    }

    location /cancel_task {
        proxy_pass http://127.0.0.1:8001;
    }
}
```

## 4. Verification

1.  Open your browser to `http://your-domain.com`.
2.  Check if the graph loads (connects to Neo4j).
3.  Try the Chat function to verify connection to the Python backend.
