# Implementación de Partidos en Progreso

## Resumen de Cambios

Se ha implementado la funcionalidad para crear partidos en borrador o en progreso y editarlos posteriormente hasta finalizarlos.

### Backend

#### Entidad `PersonalMatch`
- ✅ Añadido campo `status`: 'draft' | 'in_progress' | 'completed'
- ✅ Campo `result` ahora es nullable
- ✅ Campo `sets` tiene valor por defecto `[]`

#### DTOs
- ✅ `CreatePersonalMatchDto`: `sets` y `status` son opcionales
- ✅ `UpdatePersonalMatchDto`: Nuevo DTO para actualizar partidos

#### Servicio `PersonalTrackerService`
- ✅ `create()`: Maneja diferentes estados (`draft`, `in_progress`, `completed`)
- ✅ `findOne()`: Busca un partido por ID
- ✅ `update()`: Actualiza un partido existente
- ✅ `findInProgress()`: Lista partidos en borrador o en progreso

#### Controlador `PersonalTrackerController`
- ✅ `GET /personal-tracker/:id`: Obtener un partido por ID
- ✅ `PATCH /personal-tracker/:id`: Actualizar un partido
- ✅ `GET /personal-tracker/in-progress`: Listar partidos en progreso

#### Migración
- ✅ `1738523200000-AddStatusToPersonalMatches.ts`: Añade campo status y hace result nullable

### Frontend

#### Servicio `PersonalTrackerService`
- ✅ `getMatch(id)`: Obtener un partido por ID
- ✅ `updateMatch(id, updates)`: Actualizar un partido
- ✅ `getInProgress()`: Obtener partidos en progreso

#### Componente `MatchFormComponent`
- ✅ Soporte para modo edición (detecta parámetro `:id` en la ruta)
- ✅ Carga datos del partido si está en modo edición
- ✅ Tres acciones disponibles:
  - 💾 **Guardar Borrador**: Guarda sólo jugadores, sin sets (status: 'draft')
  - ⏳ **Guardar en Progreso**: Guarda con sets parciales (status: 'in_progress')
  - ✅ **Finalizar Partido**: Completa el partido (status: 'completed')

#### Rutas
- ✅ `/personal-tracker/new`: Crear nuevo partido
- ✅ `/personal-tracker/edit/:id`: Editar partido existente

## Flujo de Uso

1. **Crear Borrador**: Usuario registra jugadores pero aún no tiene marcadores
   ```typescript
   { partnerId, rival1Id, rival2Id, status: 'draft', sets: [] }
   ```

2. **Guardar en Progreso**: Usuario va añadiendo sets conforme se juega
   ```typescript
   { ...matchData, status: 'in_progress', sets: [set1, set2] }
   ```

3. **Finalizar Partido**: Usuario completa todos los sets y finaliza
   ```typescript
   { ...matchData, status: 'completed', sets: [set1, set2, set3] }
   ```

## Próximos Pasos

1. Agregar estilos CSS para los nuevos botones en `match-form.component.css`
2. Actualizar el dashboard para mostrar partidos en progreso
3. Probar la funcionalidad end-to-end
4. Ejecutar migración en la base de datos

## Comandos de Prueba

```bash
# Ejecutar migración
cd backend
npm run migration:run

# Iniciar backend
npm run start:dev

# Iniciar frontend
cd ../frontend
npm start
```
