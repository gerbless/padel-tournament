# ============================================
# Unified Dockerfile: Backend + Frontend
# Single container with nginx + Node.js
# ============================================

# --- Stage 1: Build Backend ---
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

# --- Stage 2: Build Frontend ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .

# Override apiUrl to use relative path (nginx will proxy /api -> backend)
RUN mkdir -p src/environments && \
    echo 'export const environment = { production: true, apiUrl: "/api" };' > src/environments/environment.prod.ts

RUN npm run build

# --- Stage 3: Production ---
FROM node:20-alpine

# Install nginx and supervisor
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# --- Backend ---
COPY backend/package*.json ./
RUN npm ci --only=production
COPY --from=backend-builder /app/backend/dist ./dist

# --- Frontend (static files) ---
COPY --from=frontend-builder /app/frontend/dist/padel-tournament/browser /usr/share/nginx/html

# --- Nginx config ---
COPY nginx-unified.conf /etc/nginx/http.d/default.conf

# --- Supervisor config ---
COPY supervisord.conf /etc/supervisord.conf

# Expose single port
EXPOSE 80

# Start both services via supervisor
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
