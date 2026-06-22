# Deploy manual V2 - Gestion SyTec

Git y Docker se administran por separado. Este documento es una guia operativa: los comandos no deben ejecutarse hasta que la version haya sido revisada y aprobada.

## Preparacion

1. Confirmar que la rama `dev` este probada en desarrollo.
2. Obtener la aprobacion final y hacer el merge `dev -> main`.
3. Registrar el commit estable anterior para disponer de una referencia de rollback.
4. En el servidor, realizar un backup de la base antes de actualizar codigo o contenedores.

Ejemplo orientativo de backup, sin incluir credenciales reales:

```bash
docker compose exec -T gestion_personal_sytec_db pg_dump -U postgres -d gestion_personal_sytec > gestion_personal_sytec_backup_before_v2.sql
```

Guardar el backup fuera del arbol del repositorio y comprobar que el archivo no este vacio.

## Deploy

1. Actualizar el codigo aprobado manualmente o mediante `git pull`, segun el procedimiento del servidor.
2. Rebuild solo de API y WEB:

```bash
docker compose build gestion_personal_sytec_api gestion_personal_sytec_web
```

3. Levantar solo API y WEB:

```bash
docker compose up -d gestion_personal_sytec_api gestion_personal_sytec_web
```

4. Si el Dockerfile o entrypoint de API mantiene configurado `prisma migrate deploy`, la API aplicara las migraciones pendientes al iniciar. No ejecutar `migrate reset`.
5. Verificar logs:

```bash
docker compose logs --tail=120 gestion_personal_sytec_api
docker compose logs --tail=120 gestion_personal_sytec_web
```

6. Probar login ADMIN y confirmar dashboard, auditoria, configuracion, comunicados y exportaciones.
7. Probar login EMPLOYEE y confirmar perfil, parte diario, licencias, proyectos, comunicados y permisos restringidos.

## Rollback

1. Volver al commit anterior estable.
2. Rebuild y levantar solo API/WEB con los comandos anteriores.
3. Si una migracion ya fue aplicada, no intentar un rollback destructivo ni editar manualmente la tabla de migraciones.
4. Restaurar el backup solo si es estrictamente necesario y mediante un procedimiento controlado.
5. Conservar logs y documentar el motivo del rollback.

Este documento no contiene contrasenas, valores de `.env` ni datos productivos.
