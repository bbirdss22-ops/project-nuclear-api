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

## Swagger / OpenAPI Security

```ts
// main.ts — กำหนด security scheme ชื่อ 'access-token'
.addBearerAuth(
  { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  'access-token',
)
```

**Protected endpoints** ใช้ `@ApiBearerAuth('access-token')` decorator — Swagger จะส่ง token ผ่าน Header: `Authorization: Bearer <token>`

| Decorator | ใช้กับ |
|-----------|-------|
| `@ApiBearerAuth()` ❌ | ไม่ถูกต้อง — ต้องระบุ scheme name |
| `@ApiBearerAuth('access-token')` ✅ | ถูกต้อง — match กับ security scheme ใน main.ts |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | ❌ | Health check |
| POST | `/api/auth/login` | ❌ | Admin login (JWT) |
| POST | `/api/auth/change-password` | ✅ Bearer | เปลี่ยนรหัสผ่าน |
| GET | `/api/user-profile/me` | ✅ Bearer | Get profile (auto-create) |
| PUT | `/api/user-profile/me` | ✅ Bearer | Update profile |
| POST | `/api/customers` | ❌ | Create customer (public) |
| GET | `/api/customers` | ✅ Bearer | List customers (paginated) |
| GET | `/api/customers/search` | ✅ Bearer | Search customers |
| GET | `/api/customers/:id` | ✅ Bearer | Customer detail |
| GET | `/api/customers/line/:lineUserId` | ✅ Bearer | Find by Line ID |
| PATCH | `/api/customers/:id` | ✅ Bearer | Update customer |
| POST | `/api/line/webhook` | ❌ | Line webhook |

## Pagination Standard

ทุก endpoint ที่ return list **ต้องใช้ format นี้เท่านั้น**:

```json
{
  "data": [...],
  "page": 1,
  "pageSize": 20,
  "totalItems": 100,
  "totalPages": 5,
  "_links": {
    "self": "/api/xxx?page=1&pageSize=20",
    "next": "/api/xxx?page=2&pageSize=20",
    "prev": null
  }
}
```

**Query params:**
- `page` (optional, default 1)
- `pageSize` (optional, default 20)
- `limit` (optional, backward compat — alias for pageSize)

**Interface:** `src/common/interfaces/pagination.interface.ts` — `PaginatedResponse<T>`

**Prisma:** ต้องใช้ `orderBy: { createdAt: 'desc' }` เสมอกับ list queries

## Database

Schema: `prisma/schema.prisma`

Key tables: `users`, `customers`, `line_events`, `products`, `orders`, `order_items`, `commission_config`, `binary_volumes`, `commissions`, `commission_payouts`, `payout_periods`

## Deployment

Render auto-deploys from `main` branch.

Build command: `npm install && npm run build`
Start command: `npm run start:prod`

## Related Repos

- [project-newclear](https://github.com/bbirdss22-ops/project-newclear) — Planning docs & full system design
