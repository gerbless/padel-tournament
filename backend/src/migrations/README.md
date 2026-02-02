# Database Migrations

Este directorio contiene las migraciones de TypeORM para la base de datos del proyecto.

## Orden de Ejecución

Las migraciones se ejecutan en orden cronológico según su timestamp:

1. **1706846400000-AddConfigToTournaments.ts**
   - Agrega configuración a los torneos

2. **1706899100000-CreatePersonalMatchesResultEnum.ts**
   - Crea el enum `personal_matches_result_enum` con valores: `'win'`, `'loss'`
   - Usa un bloque `DO` para ser idempotente (no falla si ya existe)

3. **1706899200000-AddUsersAndPersonalMatches.ts**
   - Crea la tabla `users`
   - Crea la tabla `personal_matches`
   - Vincula usuarios a jugadores mediante `playerId`
   - Usa el enum `personal_matches_result_enum`
   - **Nota**: Esta migración también crea el enum por si se ejecuta sola

4. **1738523089000-ChangePersonalMatchOwnerToUser.ts**
   - Modifica la FK de `ownerId` en `personal_matches`
   - Cambia de referenciar `players(id)` a `users(id)`
   - Los partidos personales ahora pertenecen a usuarios, no a jugadores

## Ejecutar Migraciones

```bash
# Ejecutar migraciones pendientes
npm run migration:run

# Revertir última migración
npm run migration:revert

# Generar nueva migración (requiere cambios en entidades)
npm run migration:generate -- src/migrations/MigrationName
```

## Notas Importantes

- **`synchronize: true`** está habilitado en desarrollo, por lo que TypeORM aplica cambios automáticamente
- En producción, se recomienda desactivar `synchronize` y usar solo migraciones
- Las migraciones están diseñadas para ser **idempotentes** cuando es posible
- El enum `personal_matches_result_enum` se crea con manejo de errores para evitar conflictos

## Estado Actual de la Base de Datos

- ✅ Usuarios vinculados a jugadores mediante `playerId`
- ✅ Partidos personales pertenecen a usuarios (`ownerId` → `users.id`)
- ✅ Enum `personal_matches_result_enum` con valores `win`/`loss`
- ✅ Todas las relaciones con jugadores, clubes, etc.
