# 🚀 Instrucciones de Despliegue - Listo para Usar

## ✅ Estado del Proyecto

Todas las imágenes de Docker han sido construidas exitosamente:
- ✅ **Backend (NestJS)** - Imagen construida
- ✅ **Frontend (Angular)** - Imagen construida (bundle optimizado: 272 KB)
- ✅ **PostgreSQL** - Imagen oficial lista

## 🎯 Inicio Rápido

### 1. Levantar la Aplicación Completa

```bash
cd /Users/germainbueno/.gemini/antigravity/scratch/padel-tournament
docker-compose up -d
```

### 2. Verificar que Todo Esté Corriendo

```bash
docker-compose ps
```

Deberías ver:
```
NAME                         STATUS              PORTS
padel-tournament-backend     Up (healthy)        0.0.0.0:3000->3000/tcp
padel-tournament-db          Up (healthy)        0.0.0.0:5432->5432/tcp
padel-tournament-frontend    Up                  0.0.0.0:80->80/tcp
```

### 3. Acceder a la Aplicación

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000

## 📝 Primeros Pasos en la Aplicación

### Crear Tu Primer Torneo

1. Abre http://localhost en tu navegador
2. Haz clic en **"➕ Crear Torneo"**
3. Completa el formulario:
   - **Nombre**: "Torneo de Verano 2026"
   - **Tipo**: Cuadrangular (4 parejas) o Hexagonal (6 parejas)
   - **Jugadores**: Ingresa los nombres de las parejas
4. Haz clic en **"✅ Crear Torneo"**

### Ingresar Resultados

1. En la vista del torneo, verás una grilla con todos los partidos
2. Haz clic en cualquier partido
3. Ingresa los resultados por set:
   - Ejemplo Set 1: `6 - 4` (primer equipo ganó 6-4)
   - Ejemplo Set 2: `7 - 5` (primer equipo ganó 7-5)
4. Haz clic en **"💾 Guardar"**

La tabla de clasificaciones se actualizará automáticamente.

## 🛠️ Comandos Útiles

### Ver Logs en Tiempo Real

```bash
# Todos los servicios
docker-compose logs -f

# Solo frontend
docker-compose logs -f frontend

# Solo backend
docker-compose logs -f backend
```

### Reiniciar un Servicio

```bash
docker-compose restart backend
docker-compose restart frontend
```

### Detener Todo

```bash
docker-compose down
```

### Detener y Eliminar Base de Datos (⚠️)

```bash
docker-compose down -v
```

## 🔍 Verificación

### Probar el Backend Directamente

```bash
# Obtener todos los torneos
curl http://localhost:3000/tournaments

# Crear un torneo de prueba
curl -X POST http://localhost:3000/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Torneo Test",
    "type": "cuadrangular",
    "teams": [
      {"player1Name": "Juan", "player2Name": "Pedro"},
      {"player1Name": "María", "player2Name": "Ana"},
      {"player1Name": "Carlos", "player2Name": "Luis"},
      {"player1Name": "Sofía", "player2Name": "Laura"}
    ]
  }'
```

### Verificar Base de Datos

```bash
docker-compose exec postgres psql -U postgres -d padel_tournament -c "SELECT * FROM tournaments;"
```

## 📊 Características Implementadas

✅ **Generación Automática de Partidos Round-Robin**
  - Cuadrangular: 6 partidos (C(4,2))
  - Hexagonal: 15 partidos (C(6,2))

✅ **Validación de Resultados según Reglas de Pádel**
  - Mínimo 6 juegos con 2 de diferencia
  - Tie-breaks a 7 puntos (en caso de 6-6)
  - Mejor de 3 sets

✅ **Cálculo Automático de Clasificaciones**
  1. Partidos ganados
  2. Diferencia de sets
  3. Diferencia de juegos
  4. Resultado directo

✅ **Interfaz Moderna**
  - Diseño glassmorphism
  - Gradientes vibrantes
  - Animaciones suaves
  - Responsive design

## 🎨 Capturas

Una vez que levantes la aplicación, verás:
- 🏠 **Página principal**: Lista de torneos con cards animadas
- ➕ **Formulario de creación**: Campos dinámicos según tipo de torneo
- 📊 **Vista de torneo**: Grid de partidos + Tabla de clasificaciones
- 🎯 **Modal de resultados**: Entrada fácil de sets

## 📚 Documentación Adicional

- **README.md** - Guía completa de instalación (local y Docker)
- **DOCKER.md** - Guía detallada de Docker con troubleshooting
- **walkthrough.md** - Documentación técnica completa

## 🚀 ¡Todo Listo!

Tu aplicación está completamente configurada y lista para usar. Solo ejecuta:

```bash
docker-compose up -d
```

Y abre http://localhost en tu navegador.

**¡Disfruta gestionando tus torneos de pádel!** 🎾
