# Multi-Tenant Real Estate SaaS Platform

A full-stack Real Estate SaaS platform built with Node.js, Express, MongoDB, Redis, and a React single-page web app.

## 🚀 Current Status: Complete (10/10 Phases)

**Latest Update:** Phase 9 - Testing (Jest + Supertest, 153 tests green) ✅
**Also shipped:** Phase 10 — React/Vite web app served by the same Express server.

---

## ✅ Completed Features

### Phase 1: Project Setup & Infrastructure ✅
- Node.js + Express with JavaScript
- MongoDB + Mongoose (6+ database schemas)
- Redis connection for caching & rate limiting
- Docker & Docker Compose setup
- Security middleware (Helmet, CORS)
- Global error handling
- ESLint & Prettier

### Phase 2: Authentication & Multi-tenancy ✅
- JWT authentication (access + refresh tokens)
- User registration with email verification
- Login/logout, password reset flow
- Organization (tenant) management with **enforced membership isolation**
- Member invitation system (admin only)
- Role-Based Access Control (Admin, Manager, Member) with role-based permissions
- Permission-based middleware

### Phase 3: Property Management ✅
- Property CRUD with validation
- Advanced filtering (price, location, type, status)
- Pagination & sorting
- Full-text search on MongoDB
- Image management
- Property statistics dashboard (total, avg/min/max price, by-status, by-type)

### Phase 4: Task/Lead Management & Real-Time ✅
- Task CRUD with status workflow
- Comment system with activity logs
- Task assignment & priority
- **WebSocket real-time notifications** (Socket.IO)
- Organization-based rooms for tenant isolation

### Phase 5: Caching & Performance ✅
- Redis caching layer with automatic invalidation
- Advanced rate limiting (per-user & per-org)
- Rate limit tiers (auth, read, write, upload)
- Graceful fallback when Redis unavailable

### Phase 6: File Uploads ✅
- Multer-based uploads (property images, task attachments, avatars)
- Stored under `uploads/`, served at `/uploads`

### Phase 7: Background Jobs ✅
- Bull + Redis queues: email, task reminders, analytics, cleanup
- Email worker with templates (welcome, password reset, member invite, daily digest)
- Task reminder worker (open/overdue tasks)

### Phase 8: Administration ✅
- Admin routes: manage users & organizations, system stats
- Queue management routes (pause/resume/clean)

### Phase 9: Testing ✅ (NEW!)
- **Jest + Supertest suite: 10 suites, 153 tests — all green**
- Integration tests for auth, orgs, properties, tasks, and **multi-tenant isolation**
- Unit tests for models, utils, email service, and queue config
- Dedicated test database (`real-estate-saas-test`) - tests **never** touch the dev DB
- `npm test` for the full suite, `npm run lint` for code quality

### Phase 10: Web Application ✅
- React SPA built with Vite and served by the same Express server
- React Router navigation and protected customer/organization routes
- Customer dashboard with marketplace filters, favourites, enquiries, profile, and support tickets
- Browser routing: login, register, org switcher, dashboard, properties, tasks, members, settings
- Role-aware UI and immutable account onboarding for customer, buyer, renter, organization, broker, and agent accounts
- Socket.IO client wired for real-time task updates
- Serves the SPA for browsers (`Accept: text/html`) and JSON for API clients

---

## 📊 API Endpoints

### Authentication (8 endpoints)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

### Organizations (7 endpoints)
```
POST   /api/orgs
GET    /api/orgs
GET    /api/orgs/:orgId
PUT    /api/orgs/:orgId
POST   /api/orgs/:orgId/members
GET    /api/orgs/:orgId/members
DELETE /api/orgs/:orgId/members/:userId
```

### Properties (8 endpoints)
```
POST   /api/properties
GET    /api/properties
GET    /api/properties/:id
PUT    /api/properties/:id
DELETE /api/properties/:id
POST   /api/properties/:id/images
GET    /api/properties/search/query
GET    /api/properties/stats/overview
```

### Public Marketplace (2 endpoints)
```
GET    /api/public/properties
GET    /api/public/properties/:id
```

### Tasks (6 endpoints)
```
POST   /api/tasks
GET    /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/comments
```

All resource routes (properties, tasks) are scoped by the `x-organization-id` header
and verified against the caller's active membership - cross-tenant access returns 403.

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20 LTS | JavaScript runtime |
| Framework | Express.js | Web framework |
| Language | JavaScript (ES6+) | Development language |
| Frontend | React | Component-based web application |
| Frontend build | Vite | Development server and production bundling |
| Database | MongoDB | NoSQL database |
| ORM | Mongoose | MongoDB modeling |
| Cache | Redis | Caching & rate limiting |
| Queues | Bull | Background jobs |
| Real-time | Socket.IO | WebSocket connections |
| Auth | JWT | Stateless authentication |
| Security | Helmet, CORS | HTTP security |
| Validation | express-validator | Input validation |
| Testing | Jest + Supertest | Automated tests |
| Dev Tools | ESLint, Prettier | Code quality |
| Containers | Docker | Development environment |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Docker)
- Redis (local or Docker)

### Installation

```bash
# Install dependencies
npm install

# Start MongoDB & Redis
docker-compose up -d

# Create .env (see .env.example) - set MONGODB_URI and MONGODB_TEST_URI
cp .env.example .env

# Start backend development server
npm run dev

# In another terminal, start the React development server
npm run dev:frontend

# Build React into public/ for Express to serve
npm run build
```

Server runs at: **http://localhost:5000** — the web app is served at `/`.

**Important:** SMTP credentials in `.env` must be valid for verification/reset emails.
Registration/login still succeed if email delivery fails.

### Testing

```bash
# Run the full test suite (uses real-estate-saas-test DB; never the dev DB)
npm test

# Run ESLint on src/
npm run lint
```

---

## 🔒 Security Features

- ✅ Password hashing (bcrypt)
- ✅ JWT access & refresh tokens
- ✅ Email verification
- ✅ Password reset flow
- ✅ Redis-backed rate limiting
- ✅ CORS configuration
- ✅ Security headers (Helmet with CSP for the SPA)
- ✅ Input validation & sanitization
- ✅ Role-based access control (RBAC) + per-permission checks
- ✅ **Enforced multi-tenant isolation** - org context verifies active membership on every scoped route

---

## 📁 Project Structure

```
src/
├── config/           # db, redis, socket, queue, storage, env
├── middleware/       # auth (JWT + orgContext), rbac, security, rate limiting, cache, errorHandler
├── models/           # User, Organization, Member, Property, Task, AuditLog
├── routes/           # auth, orgs, properties, tasks, uploads, queues, admin
├── services/         # emailService
├── utils/            # cache, generateToken, emailService
├── workers/          # emailWorker, taskReminderWorker, analyticsWorker, cleanupWorker
└── index.js          # Main app (serves API + SPA)
frontend/             # React/Vite source application
public/               # Vite build output and static assets
tests/
├── setup.js          # Test DB connection + teardown (safety-guarded)
├── integration/      # auth, orgs, properties, tasks, multitenancy, health
└── unit/             # models, utils, emailService, queue
```

---

## 👤 Author

**Divyanshu**
- GitHub: [@Divyanshu-23](https://github.com/Divyanshu-23)

---

## 📄 License

MIT License

---

**Built for learning and demonstrating production-ready full-stack engineering skills.**

Last Updated: 2026-09-12
