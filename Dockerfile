# Build Stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Verify build output
RUN ls -la /app/dist

# Runtime Stage
FROM python:3.11-slim
WORKDIR /app

# Install Nginx and system dependencies
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY api_llm.py lightrag_wrapper.py ./
# Copy existing config if any (as fallback)
COPY neo4j-link.txt ./

# Create data dir
RUN mkdir lightrag_data

# Copy Frontend Build
COPY --from=builder /app/dist /usr/share/nginx/html
# Fix permissions for Nginx
RUN chown -R www-data:www-data /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html

# Copy Configs
# Overwrite main config
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Port
EXPOSE 80

CMD ["/entrypoint.sh"]
