# 🐋 Docker Deployment Guide

Guía completa para levantar la aplicación de torneos de pádel usando Docker y Docker Compose.

## 📋 Requisitos

- Docker 20.10+
- Docker Compose 2.0+

## 🚀 Inicio Rápido

### 1. Levantar toda la aplicación

```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Este comando levantará:
- **PostgreSQL** en puerto `5432`
- **Backend (NestJS)** en puerto `3000`
- **Frontend (Angular)** en puerto `80`

### 2. Verificar que los contenedores estén corriendo

```bash
docker-compose ps
```

Deberías ver:
```
NAME                         STATUS    PORTS
padel-tournament-db          Up        0.0.0.0:5432->5432/tcp
padel-tournament-backend     Up        0.0.0.0:3000->3000/tcp
padel-tournament-frontend    Up        0.0.0.0:80->80/tcp
```

### 3. Acceder a la aplicación

Abre tu navegador en: **http://localhost**

La API REST está disponible en: **http://localhost:3000**

## 🛠️ Comandos Útiles

### Ver logs en tiempo real

```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend

# Solo base de datos
docker-compose logs -f postgres
```

### Detener la aplicación

```bash
docker-compose down
```

### Detener y eliminar volúmenes (⚠️ elimina la base de datos)

```bash
docker-compose down -v
```

### Reconstruir las imágenes

```bash
# Reconstruir todo
docker-compose up -d --build

# Reconstruir solo el backend
docker-compose up -d --build backend

# Reconstruir solo el frontend
docker-compose up -d --build frontend
```

### Reiniciar un servicio específico

```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart postgres
```

### Acceder a un contenedor

```bash
# Backend
docker-compose exec backend sh

# Frontend (nginx)
docker-compose exec frontend sh

# PostgreSQL
docker-compose exec postgres psql -U postgres -d padel_tournament
```

## 📊 Arquitectura de Contenedores

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  http://localhost                                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Frontend Container (nginx:alpine)                  │
│  Port: 80                                           │
│  - Sirve aplicación Angular                         │
│  - Compresión gzip                                  │
│  - SPA routing                                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼ HTTP API calls
┌─────────────────────────────────────────────────────┐
│  Backend Container (node:20-alpine)                 │
│  Port: 3000                                         │
│  - NestJS API                                       │
│  - TypeORM                                          │
│  - Validación & Business Logic                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼ PostgreSQL queries
┌─────────────────────────────────────────────────────┐
│  PostgreSQL Container (postgres:16-alpine)          │
│  Port: 5432                                         │
│  - Base de datos relacional                         │
│  - Volumen persistente (postgres_data)              │
└─────────────────────────────────────────────────────┘
```

## 🔧 Configuración

### Variables de Entorno

Las variables de entorno están definidas en `docker-compose.yml`:

```yaml
# Base de datos
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
POSTGRES_DB: padel_tournament

# Backend
DB_HOST: postgres
DB_PORT: 5432
NODE_ENV: production
```

Para cambiar las credenciales, edita el archivo `docker-compose.yml`.

### Volúmenes

- `postgres_data`: Almacena los datos de PostgreSQL de forma persistente

### Redes

Todos los servicios están conectados a la red `padel-network`, permitiendo comunicación entre contenedores.

## 🐛 Troubleshooting

### El backend no puede conectarse a la base de datos

**Problema**: Error `ECONNREFUSED` o `connection refused`

**Solución**:
```bash
# Verificar que postgres esté saludable
docker-compose ps

# Ver logs de postgres
docker-compose logs postgres

# Reiniciar postgres
docker-compose restart postgres

# Si persiste, recrear desde cero
docker-compose down -v
docker-compose up -d
```

### Puerto ya en uso

**Problema**: `bind: address already in use`

**Solución**:
```bash
# Identificar qué proceso usa el puerto (ej: 80)
lsof -i :80

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en docker-compose.yml:
# ports:
#   - "8080:80"  # Usar puerto 8080 en lugar de 80
```

### Cambios en el código no se reflejan

**Solución**:
```bash
# Reconstruir las imágenes
docker-compose up -d --build
```

### Ver estado de salud de los contenedores

```bash
docker inspect padel-tournament-db | grep -A 10 Health
```

## 🔒 Producción

Para desplegar en producción:

1. **Cambiar credenciales de base de datos**:
   - Usa variables de entorno seguras
   - No uses contraseñas por defecto

2. **Configurar dominio**:
   - Actualiza `frontend/src/environments/environment.prod.ts`
   - Cambia `apiUrl` a tu dominio de backend

3. **Agregar SSL/TLS**:
   - Usa un reverse proxy como Traefik o nginx
   - Configura certificados Let's Encrypt

4. **Limitar recursos**:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

## 📈 Monitoreo

### Ver uso de recursos

```bash
docker stats
```

### Backup de la base de datos

```bash
# Crear backup
docker-compose exec postgres pg_dump -U postgres padel_tournament > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U postgres padel_tournament < backup.sql
```

## 🧹 Limpieza

```bash
# Eliminar contenedores detenidos
docker-compose down

# Eliminar contenedores y volúmenes
docker-compose down -v

# Limpiar imágenes huérfanas
docker image prune -a
```

## 📝 Notas

- Los contenedores se reinician automáticamente (`restart: unless-stopped`)
- PostgreSQL tiene un healthcheck para asegurar que esté listo antes de iniciar el backend
- El frontend se sirve a través de nginx con cache y compresión habilitadas
- Todos los logs están disponibles con `docker-compose logs`
