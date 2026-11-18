# UNZUR (أنظر)

Online store for sculptural furniture and lighting, with an admin dashboard.

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST + GraphQL API, jobs, emails, push | NestJS, Prisma, PostgreSQL, Upstash Redis |
| `frontend/` | Storefront (Arabic + English) and dashboard | Next.js |

## Run locally

```bash
docker compose up -d            # PostgreSQL + Redis
cd backend && cp .env.example .env && npm install && npx prisma migrate deploy --config prisma7.config.ts && npm run seed && npm run start:dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

The site runs on http://localhost:3000, the API on http://localhost:4000/api/v1.
Optional demo data for the dashboard: `cd backend && npm run demo:seed` (remove with `npm run demo:clean`).
