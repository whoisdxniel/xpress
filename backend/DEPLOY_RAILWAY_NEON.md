# Deploy Backend en Railway + Neon (Postgres)

Este backend usa Node/Express + Prisma.

## 1) Crear la base de datos en Neon

1. Creá un proyecto en Neon.
2. Copiá las 2 cadenas de conexión (si Neon te las ofrece):
   - **Pooled** (pooler) → usarla como `DATABASE_URL` (runtime del backend).
   - **Direct** (direct connection) → usarla como `DIRECT_URL` (migraciones Prisma).

Ejemplo (Neon suele requerir SSL):
- `postgresql://USER:PASS@HOST/DB?sslmode=require`

## 2) Crear el servicio en Railway

1. Railway → New Project → Deploy from GitHub (o el método que uses).
2. Si tu repo es monorepo, configurá el servicio con **Root Directory = `backend`**.
3. Comandos recomendados:
   - **Build**: `npm run build`
   - **Start**: `npm run start:railway`

`start:railway` corre `prisma migrate deploy` y luego arranca el server.

## 3) Variables de entorno (Railway)

Mínimas:
- `DATABASE_URL` = Neon pooled
- `DIRECT_URL` = Neon direct (recomendado)
- `JWT_SECRET` = mínimo 20 chars
- `JWT_EXPIRES_IN` = por ejemplo `7d`
- `CORS_ORIGIN` = por ejemplo `http://localhost:19006` (dev)

Uploads (Cloudinary) (recomendado en Railway):
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- (opcional) `CLOUDINARY_FOLDER` (default: `xpress`)

Notas:
- Si NO configurás Cloudinary, el backend cae a uploads locales (en Railway el disco no es persistente).

## 4) Verificación rápida

Cuando termine el deploy:
- `GET /health` → `{ ok: true }`
- `GET /health/db` → `{ ok: true }` si Prisma conecta bien

## 5) Seed (crear admin y usuarios demo)

El repo trae un seed por Prisma (admin + usuarios demo). Opciones:

- Local (apunta a Neon):
  1. En `backend/`, configurá `DATABASE_URL`/`DIRECT_URL` hacia Neon.
  2. Corré `npx prisma migrate deploy`
  3. Corré `npx prisma db seed`

Credenciales que crea el seed:
- Admin: `admin@xpress.local` / `xpress_admin`
- Cliente demo: `cliente@xpress.local` / `xpress_test`
- Chofer demo: `chofer@xpress.local` / `xpress_test`

## 6) Conectar el frontend

En el frontend, apuntá `EXPO_PUBLIC_API_BASE_URL` a tu backend Railway:
- `https://TU-SERVICIO.up.railway.app/api`
