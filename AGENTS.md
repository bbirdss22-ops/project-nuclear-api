# Project Nuclear API 🤖

> NestJS Backend for Project Nuclear — Line OA + MLM Platform

## Tech Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Runtime | Node.js v24 | Render (Free) |
| Framework | NestJS 11 | — |
| Database | PostgreSQL (Neon) | Neon Free Tier |
| ORM | Prisma 7 | — |
| Auth | JWT (Passport) | — |
| Messaging | Line Messaging API | Free |

## Directory Structure

```
src/
├── main.ts                  # Entry point
├── app.module.ts            # Root module
├── app.controller.ts        # Health check
├── prisma/
│   ├── prisma.module.ts     # Global Prisma module
│   └── prisma.service.ts    # Prisma client (driver adapter)
├── auth/                    # Auth module (JWT login)
├── customer/                # Customer module (CRUD)
└── line/                    # Line module (webhook)
```

## Development

```bash
# Install
npm install

# Generate Prisma client
npx prisma generate

# Run dev (watch mode)
npm run start:dev

# Build
npm run build

# Production
npm run start:prod
```

## Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) |
| `LINE_CHANNEL_SECRET` | Line Messaging API secret |
| `LINE_ACCESS_TOKEN` | Line Messaging API token |
| `PORT` | Server port (default: 3000) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Admin login (JWT) |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers` | List customers (protected) |
| POST | `/api/line/webhook` | Line webhook |

## Database

Schema: `prisma/schema.prisma`

Key tables: `users`, `customers`, `line_events`, `products`, `orders`, `order_items`, `commission_config`, `binary_volumes`, `commissions`, `commission_payouts`, `payout_periods`

## Deployment

Render auto-deploys from `main` branch.

Build command: `npm install && npm run build`
Start command: `npm run start:prod`

## Related Repos

- [project-newclear](https://github.com/bbirdss22-ops/project-newclear) — Planning docs & full system design
