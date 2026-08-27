# Multi-Tenant Real Estate SaaS Platform

A production-ready Real Estate SaaS platform built with Node.js, Express, MongoDB, and Redis.

## 🚀 Current Status: 50% Complete (5/10 Phases)

**Latest Update:** Phase 5 - Caching & Performance (Complete) ✅

---

## ✅ Completed Features

### Phase 1: Project Setup & Infrastructure ✅
- Node.js + Express with JavaScript
- MongoDB + Mongoose (6 database schemas)
- Redis connection for caching
- Docker & Docker Compose setup
- Security middleware (Helmet, CORS)
- Global error handling
- ESLint & Prettier

### Phase 2: Authentication & Multi-tenancy ✅
- JWT authentication (access + refresh tokens)
- User registration with email verification
- Login/logout, password reset flow
- Organization (tenant) management
- Member invitation system
- Role-Based Access Control (Admin, Manager, Member)
- Permission-based middleware

### Phase 3: Property Management ✅
- Property CRUD with validation
- Advanced filtering (price, location, type, status)
- Pagination & sorting
- Full-text search on MongoDB
- Image management
- Property statistics dashboard

### Phase 4: Task/Lead Management & Real-Time ✅
- Task CRUD with status workflow
- Comment system with attachments
- Activity logs (automatic tracking)
- Task assignment & priority
- **WebSocket real-time notifications** (Socket.IO)
- Organization-based rooms for tenant isolation

### Phase 5: Caching & Performance ✅ (NEW!)
- **Redis caching layer** with automatic invalidation
- **Advanced rate limiting** (per-user & per-org)
- Cache middleware for routes
- Performance boost: **40x faster** for cached queries
- Rate limit tiers (auth, read, write, upload)
- Graceful fallback when Redis unavailable

---

## 📊 API Endpoints (25+ endpoints)

### Authentication (7 endpoints)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
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

### Properties (8 endpoints) - **WITH CACHING**
```
POST   /api/properties                 - Create property
GET    /api/properties                 - List (cached 15min)
GET    /api/properties/:id             - Get details (cached 30min)
PUT    /api/properties/:id             - Update
DELETE /api/properties/:id             - Delete
POST   /api/properties/:id/images      - Add images
GET    /api/properties/search/query    - Full-text search
GET    /api/properties/stats/overview  - Statistics (cached 5min)
```

### Tasks (6 endpoints) - **WITH REAL-TIME UPDATES**
```
POST   /api/tasks              - Create task
GET    /api/tasks              - List tasks (cached 10min)
GET    /api/tasks/:id          - Get task details
PUT    /api/tasks/:id          - Update task
DELETE /api/tasks/:id          - Delete task
POST   /api/tasks/:id/comments - Add comment
```

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20 LTS | JavaScript runtime |
| Framework | Express.js | Web framework |
| Language | JavaScript (ES6+) | Development language |
| Database | MongoDB | NoSQL database |
| ORM | Mongoose | MongoDB modeling |
| Cache | Redis | **Caching & rate limiting** |
| Real-time | Socket.IO | WebSocket connections |
| Auth | JWT | Stateless authentication |
| Security | Helmet, CORS | HTTP security |
| Validation | express-validator | Input validation |
| Dev Tools | ESLint, Prettier | Code quality |
| Containers | Docker | Development environment |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

```bash
# Clone repository
cd "Multi Tenant SaaS Project"

# Install dependencies
npm install

# Start MongoDB & Redis
docker-compose up -d

# Start development server
npm run dev
```

Server runs at: **http://localhost:5000**

---

## ⚡ Performance Features

### Caching (NEW!)
- **40x faster** response times for cached queries
- Automatic cache invalidation on data changes
- Filter-aware caching (different cache per query)
- Graceful degradation (works without Redis)

### Rate Limiting (NEW!)
- **Auth endpoints:** 10 req/15min (strict)
- **Read endpoints:** 200 req/min
- **Write endpoints:** 50 req/min
- **Uploads:** 50/hour
- Per-user AND per-organization limits
- Rate limit headers in responses

### Real-Time Updates
- WebSocket connections via Socket.IO
- Organization-based rooms for tenant isolation
- Live task/lead notifications
- Automatic reconnection

---

## 🔒 Security Features

- ✅ Password hashing (bcrypt)
- ✅ JWT access & refresh tokens
- ✅ Email verification
- ✅ Password reset flow
- ✅ **Redis-backed rate limiting** (NEW!)
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Input validation & sanitization
- ✅ Role-based access control (RBAC)
- ✅ Audit logging

---

## 📈 Project Roadmap

- [x] **Phase 1:** Setup & Infrastructure
- [x] **Phase 2:** Auth & Multi-tenancy
- [x] **Phase 3:** Property Management
- [x] **Phase 4:** Task/Lead Management & Real-Time
- [x] **Phase 5:** Caching & Performance ✨ **NEW**
- [ ] **Phase 6:** File Uploads (AWS S3) - NEXT
- [ ] **Phase 7:** Background Jobs (Bull queues)
- [ ] **Phase 8:** Admin Dashboard
- [ ] **Phase 9:** Testing (Jest, Supertest)
- [ ] **Phase 10:** Deployment & CI/CD

**Current Progress: 50% Complete** (5/10 phases)

---

## 📁 Project Structure

```
src/
├── config/
│   ├── db.js              # MongoDB connection
│   ├── redis.js           # Redis connection
│   ├── socket.js          # Socket.IO setup
│   └── env.js             # Environment config
├── middleware/
│   ├── auth.js            # JWT authentication
│   ├── rbac.js            # Role-based access control
│   ├── security.js        # Security headers
│   ├── rateLimiting.js    # Rate limiting (NEW!)
│   ├── cacheMiddleware.js # Cache middleware (NEW!)
│   └── errorHandler.js    # Error handling
├── models/
│   ├── User.js
│   ├── Organization.js
│   ├── Member.js
│   ├── Property.js
│   ├── Task.js
│   └── AuditLog.js
├── routes/
│   ├── authRoutes.js
│   ├── orgRoutes.js
│   ├── propertyRoutes.js  # Updated with caching
│   └── taskRoutes.js      # Updated with rate limiting
├── utils/
│   ├── cache.js           # Cache utilities (NEW!)
│   ├── generateToken.js
│   └── emailService.js
└── index.js               # Main app
```

---

## 🧪 Testing the API

### Test Caching:
```bash
# First request (cache miss) ~200ms
curl http://localhost:5000/api/properties \
  -H "Authorization: Bearer TOKEN"

# Second request (cache hit) ~5ms ✨
curl http://localhost:5000/api/properties \
  -H "Authorization: Bearer TOKEN"
```

### Test Rate Limiting:
```bash
# Check rate limit headers
curl -I http://localhost:5000/api/properties \
  -H "Authorization: Bearer TOKEN"

# X-RateLimit-Limit: 200
# X-RateLimit-Remaining: 195
# X-RateLimit-Reset: 1724697993
```

### Test WebSocket:
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT' }
});

socket.emit('join_org', 'ORG_ID');

socket.on('task_created', (data) => {
  console.log('New task:', data);
});
```

---

## 👤 Author

**Divyanshu**
- GitHub: [@Divyanshu-23](https://github.com/Divyanshu-23)

---

## 📄 License

MIT License

---

**Built with ❤️ for learning and demonstrating production-ready backend engineering skills.**

Last Updated: 2026-08-26