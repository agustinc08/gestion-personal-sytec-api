# gestion-personal-sytec-api

API NestJS con Prisma, PostgreSQL local, JWT, guards por rol y hashing bcrypt-compatible.

El login del sistema es siempre `CUIL + contraseña`.

## Instalacion Local

```bash
pnpm install
copy .env.example .env
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed
pnpm run start:dev
```

La API levanta en `http://localhost:4000`.

## Variables `.env`

Ver `.env.example`. Para desarrollo local, `DATABASE_URL` debe apuntar a `localhost:5432`, no a `postgres:5432`.

Variables principales:

- `DATABASE_URL`: conexion PostgreSQL local.
- `JWT_SECRET` y `JWT_EXPIRES_IN`: firma y expiracion del token.
- `PORT`: puerto HTTP de la API.
- `CORS_ORIGIN`: origen permitido para el frontend. Este proyecto usa `http://localhost:3000`.
- `ADMIN_CUIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: admin inicial del seed.
- `ADMIN_EMAIL`: email opcional, no se usa como login.

## PostgreSQL Local

Crear la base si no existe:

```bash
createdb -U postgres gestion_personal_sytec
```

O con `psql`:

```bash
psql -U postgres -c "CREATE DATABASE gestion_personal_sytec;"
```

En Windows, si `createdb` o `psql` no estan en PATH, crear la base desde pgAdmin con nombre `gestion_personal_sytec`.

## Seed

El seed es idempotente y se puede ejecutar mas de una vez:

```bash
pnpm prisma db seed
pnpm prisma db seed
```

Admin inicial:

- CUIL: `ADMIN_CUIL`
- Password: `ADMIN_PASSWORD`
- Email opcional: `ADMIN_EMAIL`

## Importar `db-store.json`

El import esta separado del seed y no participa del runtime:

```bash
pnpm import:db-store -- .\db-store.json
```

Para validar sin escribir en PostgreSQL:

```bash
pnpm import:db-store -- .\db-store.json --dry-run
```

Tambien se puede pasar otra ruta:

```bash
pnpm import:db-store -- C:\ruta\a\db-store.json
```

## Endpoints Principales

- `GET /health`
- `POST /auth/login` con body `{ "cuil": "20000000000", "password": "..." }`
- `GET /auth/me`
- `POST /auth/change-password`
- `GET /users`
- `GET|POST|PATCH|DELETE /employees`
- `GET|POST|PATCH|DELETE /projects`
- `GET|POST|PATCH /work-logs`
- `GET|POST|PATCH /licenses`
- `GET|PATCH /strike/config`
- `GET /dashboard/admin`
- `GET /dashboard/employee`

## Seguridad

Las rutas protegidas usan JWT. Los permisos sensibles se validan en backend con `JwtAuthGuard`, `RolesGuard` y roles `ADMIN`/`EMPLOYEE`. La API no devuelve hashes ni claves.

## Docker

Pendiente para una verificacion posterior. Esta revision local no depende de Docker.
