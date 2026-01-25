# 🎾 Padel Tournament Manager

Aplicación web completa para gestión de torneos de pádel con formato round-robin (cuadrangulares y hexagonales).

## 📋 Características

- ✅ Torneos **Cuadrangulares** (4 parejas) y **Hexagonales** (6 parejas)
- ✅ Generación automática de partidos **round-robin** (todos contra todos)
- ✅ Sistema de puntuación estándar de pádel:
  - Sets con mínimo 6 juegos y 2 de diferencia
  - Tie-breaks a 7 puntos (en caso de 6-6)
  - Mejor de 3 sets
- ✅ Cálculo automático de clasificaciones con criterios:
  1. Partidos ganados
  2. Diferencia de sets
  3. Diferencia de juegos
  4. Resultado directo (head-to-head)
- ✅ Interfaz moderna con diseño glassmorphism
- ✅ Actualización en tiempo real de clasificaciones

## 🛠️ Stack Tecnológico

### Backend
- **NestJS** - Framework Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Base de datos relacional
- **TypeScript** - Lenguaje de programación

### Frontend
- **Angular 17+** - Framework con componentes standalone
- **RxJS** - Programación reactiva
- **TypeScript** - Lenguaje de programación

## 🚀 Requisitos Previos

### Opción 1: Con Docker (Recomendado)
- Docker 20.10+
- Docker Compose 2.0+

### Opción 2: Desarrollo Local
- Node.js 18+ y npm
- PostgreSQL 14+

## 📦 Instalación

### 🐋 Opción 1: Con Docker (Más Fácil)

**Levantar toda la aplicación con un solo comando:**

```bash
docker-compose up -d
```

Accede a la aplicación en `http://localhost`

Ver la [Guía de Docker](DOCKER.md) para más detalles.

---

### 💻 Opción 2: Desarrollo Local

#### 1. Configurar Base de Datos

```bash
# Crear base de datos en PostgreSQL
createdb padel_tournament

# O usando psql:
psql -U postgres
CREATE DATABASE padel_tournament;
\q
```

### 2. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales de PostgreSQL:
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=tu_password
# DB_DATABASE=padel_tournament
# PORT=3000

# Iniciar servidor en modo desarrollo
npm run start:dev
```

El backend estará disponible en `http://localhost:3000`

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start
```

El frontend estará disponible en `http://localhost:4200`

## 📖 Uso de la Aplicación

### Crear un Torneo

1. Accede a la aplicación en `http://localhost:4200`
2. Haz clic en **"Crear Torneo"**
3. Ingresa:
   - Nombre del torneo
   - Tipo (Cuadrangular o Hexagonal)
   - Nombres de los jugadores de cada pareja
4. Haz clic en **"Crear Torneo"**

La aplicación generará automáticamente todos los partidos:
- **Cuadrangular**: 6 partidos (C(4,2))
- **Hexagonal**: 15 partidos (C(6,2))

### Registrar Resultados

1. En la vista del torneo, haz clic en cualquier partido
2. Ingresa el resultado de cada set:
   - Ejemplo: `6 - 4` (equipo 1 ganó 6-4)
   - Para tie-break: `7 - 6` (el sistema validará la puntuación)
3. Puedes agregar hasta 3 sets
4. Haz clic en **"Guardar"**

### Ver Clasificaciones

La tabla de clasificaciones se actualiza automáticamente mostrando:
- **Pos**: Posición en la tabla
- **PG/PP**: Partidos ganados/perdidos
- **SG/SP**: Sets ganados/perdidos
- **DS**: Diferencia de sets (verde si positiva, roja si negativa)
- **JG/JP**: Juegos ganados/perdidos
- **DJ**: Diferencia de juegos (verde si positiva, roja si negativa)

## 🧪 Testing

### Backend

```bash
cd backend
npm run test        # Unit tests
npm run test:e2e    # E2E tests
```

### Frontend

```bash
cd frontend
npm run test        # Unit tests con Karma
```

## 📁 Estructura del Proyecto

```
padel-tournament/
├── backend/
│   ├── src/
│   │   ├── tournaments/      # Módulo de torneos
│   │   ├── matches/          # Módulo de partidos
│   │   ├── teams/            # Módulo de equipos
│   │   ├── app.module.ts     # Módulo raíz
│   │   └── main.ts           # Bootstrap
│   ├── .env                  # Variables de entorno
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── components/   # Componentes Angular
    │   │   ├── services/     # Servicios HTTP
    │   │   └── app.routes.ts # Configuración de rutas
    │   ├── environments/     # Configuración de entornos
    │   └── styles.css        # Estilos globales
    └── package.json
```

## 🔌 API Endpoints

### Torneos

- `GET /tournaments` - Listar todos los torneos
- `GET /tournaments/:id` - Obtener un torneo con partidos y equipos
- `POST /tournaments` - Crear torneo
- `GET /tournaments/:id/standings` - Obtener clasificaciones
- `DELETE /tournaments/:id` - Eliminar torneo

### Partidos

- `GET /matches/:id` - Obtener detalle de partido
- `PATCH /matches/:id/score` - Actualizar resultado

## 🎨 Diseño

La aplicación utiliza un sistema de diseño moderno con:
- **Paleta de colores vibrante** inspirada en el pádel (verdes y azules)
- **Glassmorphism** para efectos de vidrio esmerilado
- **Animaciones suaves** en transiciones y hover
- **Tipografía Inter** de Google Fonts
- **Modo oscuro** por defecto

## 🔧 Tecnologías Clave

### Validación de Sets

El sistema valida automáticamente:
- Mínimo 6 juegos para ganar un set
- Diferencia de 2 juegos (excepto en tie-break)
- En 6-6, se requiere tie-break
- Tie-break: mínimo 7 puntos con 2 de diferencia

### Algoritmo de Clasificación

```typescript
// Orden de criterios:
1. Partidos ganados (mayor es mejor)
2. Diferencia de sets (mayor es mejor)
3. Diferencia de juegos (mayor es mejor)
4. Resultado directo entre equipos empatados
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto bajo licencia MIT.

## 👨‍💻 Autor

Creado con ❤️ para la comunidad de pádel

---

## 🐛 Troubleshooting

### Error de conexión a la base de datos

```bash
# Verifica que PostgreSQL esté corriendo:
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Verifica las credenciales en .env
```

### Puerto ya en uso

```bash
# Backend (puerto 3000)
lsof -ti:3000 | xargs kill -9

# Frontend (puerto 4200)
lsof -ti:4200 | xargs kill -9
```

### Error de CORS

Verifica que el frontend esté configurado en el CORS del backend (`src/main.ts`):
```typescript
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true,
});
```
