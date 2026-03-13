# 🎾 Agon Padel

Sistema integral para la gestión de torneos de pádel, diseñado para clubes y organizadores. Permite la creación de torneos, gestión de partidos en tiempo real, y un ranking global automatizado de jugadores.

![Dashboard Preview](frontend/src/assets/dashboard-preview.png) <!-- Placeholder for actual screenshot -->

## 🚀 Características Principales

### 🏆 Gestión de Torneos
- **Formatos Flexibles**: Soporte para Cuadrangulares y Hexagonales.
- **Creación Inteligente**: Autocompletado de jugadores y detección de duplicados.
- **Hoja de Partidos**: Vista tipo "Grid" para ingresar resultados rápidamente.

### 📊 Estadísticas y Ranking (NUEVO v1.3)
- **Cálculo Idempotente**: El sistema reconstruye el historial punto a punto para garantizar la integridad de los datos.
- **Ranking Global**: Tabla de clasificación con búsqueda en tiempo real.
- **Perfiles de Jugador**: Ficha detallada con avatar, puntos totales y victorias.

### 🎨 Experiencia de Usuario
- **Modern UI**: Interfaz oscura ("Dark Mode") con efectos de desenfoque.
- **Sidebar Plegable**: Máximo espacio para las tablas de datos.
- **Dashboard**: Panel de control con métricas clave (KPIs) y gráficos interactivos.

## 🛠️ Tecnologías

### Backend
- **NestJS**: Framework progresivo de Node.js.
- **TypeORM**: ORM para PostgreSQL.
- **PostgreSQL**: Base de datos relacional robusta.
- **Docker**: Contenerización completa.

### Frontend
- **Angular 17+**: Componentes Standalone y Signals.
- **Chart.js**: Visualización de datos.
- **CSS Grid/Flexbox**: Diseño responsivo sin dependencias pesadas.

## 🏁 Guía de Inicio Rápido

### Prerrequisitos
- Docker y Docker Compose instalados.

### Instalación y Ejecución

1. **Clonar y arrancar**:
   ```bash
   # En la raíz del proyecto
   docker-compose up -d --build
   ```

2. **Acceder a la aplicación**:
   - Frontend: [http://localhost:80](http://localhost:80)
   - Backend API: [http://localhost:3000](http://localhost:3000)

### Uso Básico

1. **Crear Torneo**: Ve a la sección "Torneos", clic en "Crear", asigna un nombre y añade los jugadores.
2. **Jugar**: Entra al detalle del torneo. Ingresa los resultados de los sets (ej: 6-4, 6-2).
3. **Cerrar Torneo**: Una vez jugados todos los partidos, pulsa "Finalizar". Esto actualizará el Ranking Global.
4. **Ranking**: Consulta la tabla general para ver quién es el número 1.

## 📡 API Endpoints (Resumen)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tournaments` | Listar todos los torneos |
| POST | `/tournaments` | Crear nuevo torneo |
| POST | `/tournaments/:id/close` | Finalizar torneo y procesar stats |
| DELETE | `/tournaments/:id` | Eliminar torneo y limpiar datos huérfanos |
| GET | `/players/ranking` | Obtener clasificación global |
| GET | `/players/:id` | Detalle de jugador |

## 🧪 Pruebas y Desarrollo

Para desarrollo local sin Docker (requiere Node.js 20+ y Postgres local):

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend
cd frontend
npm install
ng serve
```

---
v1.3.0 - 2026
