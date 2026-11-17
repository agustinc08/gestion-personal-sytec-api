# Migración a VPS-05

## Cómo quedó en VPS-05

- CI (`.github/workflows/ci.yml`, con `sytec-pjn/ci-workflows`): push a `dev` construye `dev-<sha7>` y lo despliega; push a `main` construye `prod-<sha7>`; prod (y rollback) se despliega con *Run workflow* indicando el tag.
- Compose en `deploy/docker-compose.yml`, stack `/opt/docker/gestion-personal-sytec-api`, contenedores `gestion-personal-sytec-api-<env>` en el puerto 4000. Traefik rutea `/gestion-personal-sytec-api` (prod) y `/gestion-personal-sytec-api-dev` (dev) y saca el prefijo.
- Base en `postgres-main` (red `data-<env>`): `gestion_personal_sytec` y `gestion_personal_sytec_dev`, cada una con su rol dueño (`infra/scripts/create-db.sh`). Credenciales en `/opt/docker/gestion-personal-sytec-api/.env.<env>` (claves en `deploy/env.example`).
- Adjuntos (avatares y plantillas PDF de licencias) en el volumen externo `gestion-personal-sytec-uploads-<env>`, montado en `/app/uploads`.
- El arranque corre `prisma migrate deploy`. El seed **ya no** corre en cada arranque (en VPS-04 sí): pisaba el password del admin con `ADMIN_PASSWORD` y las reglas de licencias. Para una base nueva se corre a mano: `docker exec gestion-personal-sytec-api-<env> pnpm exec prisma db seed` con `ADMIN_*` en el entorno.
- `JWT_SECRET` propio por entorno (en VPS-04 era un valor de ejemplo): los usuarios tienen que volver a loguearse.

## Datos desde VPS-04

Base: `pg_dump -Fc --no-owner --no-acl` del contenedor `gestion_personal_sytec_db` y `pg_restore --no-owner --no-acl --role=<rol>` en la base nueva. Adjuntos: copiar el contenido del volumen `prod_gestionPersonalSytecUploads-volume` al volumen `gestion-personal-sytec-uploads-<env>` (dueño uid 1000, el usuario `node` de la imagen).
