# Multi-Tenant Real Estate SaaS Platform

A production-ready Real Estate SaaS platform built with Node.js, Express, MongoDB, and Redis. This project demonstrates modern backend engineering practices including multi-tenancy, authentication, role-based access control, and RESTful API design.

## 🚀 Features

### ✅ Phase 1: Project Setup & Infrastructure (COMPLETED)
- Node.js + Express setup with JavaScript
- MongoDB integration with Mongoose ODM
- Redis connection for caching
- Docker & Docker Compose configuration
- Environment-based configuration
- Security middleware (Helmet, CORS, Rate Limiting)
- Global error handling
- ESLint & Prettier for code quality

### ✅ Phase 2: Authentication & Multi-tenancy (COMPLETED)
- JWT-based authentication (access & refresh tokens)
- User registration with email verification
- Login/Logout functionality
- Password reset flow
- Organization (tenant) management
- Member invitation system
- Role-based access control (Admin, Manager, Member)
- Permission-based middleware

### 🔨 Coming Soon
- Property management CRUD
- Task/Lead management
- Real-time updates (WebSockets)
- File upload to AWS S3
- Background jobs with Bull
- Admin dashboard
- Comprehensive testing
- CI/CD with GitHub Actions

## 📁 Project Structure

```
Multi Tenant SaaS Project/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   ├── redis.js           # Redis connection
│   │   └── env.js             # Environment config loader
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication middleware
│   │   ├── rbac.js            # Role-based access control
│   │   ├── security.js        # Security headers, CORS, rate limiting
│   │   └── errorHandler.js   # Global error handling
│   ├── models/
│   │   ├── User.js            # User schema with password hashing
│   │   ├── Organization.js    # Multi-tenant organization schema
│   │   ├── Member.js          # Organization membership with roles
│   │   ├── Property.js        # Real estate listing schema
│   │   ├── Task.js            # Task/lead management schema
│   │   ├── AuditLog.js        # Activity tracking schema
│   │   └── index.js           # Model exports
│   ├── routes/
│   │   ├── authRoutes.js      # Authentication endpoints
│   │   └── orgRoutes.js       # Organization endpoints
│   ├── utils/
│   │   ├── generateToken.js   # JWT token generation
│   │   └── emailService.js    # Email sending utility
│   └── index.js               # Express app entry point
├── .env                       # Environment variables
├── .env.example               # Environment template
├── package.json               # Dependencies
├── docker-compose.yml         # MongoDB + Redis containers
├── Dockerfile                 # Production container
├── .eslintrc.json            # Linting configuration
├── .prettierrc.json          # Code formatting
└── .gitignore                # Git ignore rules
```

## 🛠️ Technology Stack

| Component       | Technology           | Purpose                                    |
|-----------------|----------------------|--------------------------------------------|
| Runtime         | Node.js 20 LTS       | JavaScript runtime                         |
| Framework       | Express.js           | Web framework                              |
| Database        | MongoDB              | NoSQL database for flexibility             |
| ORM             | Mongoose             | MongoDB object modeling                    |
| Cache           | Redis                | Session storage, caching, rate limiting    |
| Authentication  | JWT                  | Stateless authentication                   |
| Validation      | express-validator    | Request validation                         |
| Email           | Nodemailer           | Email notifications                        |
| Security        | Helmet, CORS         | HTTP security headers                      |
| Containerization| Docker               | Consistent development environment         |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Docker & Docker Compose installed
- Git installed

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd "Multi Tenant SaaS Project"
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your actual values
```

4. **Start MongoDB and Redis with Docker**
```bash
docker-compose up -d
```

5. **Start the development server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📚 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint                  | Description                | Auth Required |
|--------|---------------------------|----------------------------|---------------|
| POST   | `/api/auth/register`      | Register new user          | No            |
| POST   | `/api/auth/login`         | Login user                 | No            |
| POST   | `/api/auth/refresh`       | Refresh access token       | No            |
| POST   | `/api/auth/logout`        | Logout user                | Yes           |
| POST   | `/api/auth/verify-email`  | Verify email address       | No            |
| POST   | `/api/auth/forgot-password`| Request password reset    | No            |
| POST   | `/api/auth/reset-password`| Reset password with token  | No            |

### Organizations (`/api/orgs`)

| Method | Endpoint                          | Description                | Auth Required | Role Required    |
|--------|-----------------------------------|----------------------------|---------------|------------------|
| POST   | `/api/orgs`                       | Create organization        | Yes           | Any              |
| GET    | `/api/orgs`                       | List user's organizations  | Yes           | Any              |
| GET    | `/api/orgs/:orgId`                | Get organization details   | Yes           | Member           |
| PUT    | `/api/orgs/:orgId`                | Update organization        | Yes           | Admin            |
| POST   | `/api/orgs/:orgId/members`        | Invite member              | Yes           | Admin, Manager   |
| GET    | `/api/orgs/:orgId/members`        | List members               | Yes           | Member           |
| DELETE | `/api/orgs/:orgId/members/:userId`| Remove member              | Yes           | Admin            |

## 🔐 Authentication Flow

1. **Register**: `POST /api/auth/register` with email, password, firstName, lastName
2. **Verify Email**: Check email for verification link
3. **Login**: `POST /api/auth/login` with email and password
4. **Use Token**: Include `Authorization: Bearer <token>` in request headers
5. **Refresh**: When token expires, use `POST /api/auth/refresh` with refresh token

## 🏢 Multi-Tenancy

### Organization Roles
- **Admin**: Full control over organization (manage settings, members, all resources)
- **Manager**: Can invite members, manage properties and tasks
- **Member**: View-only access, can be assigned tasks

### Permissions System
Permissions are automatically set based on role, including:
- Property CRUD operations
- Task management
- Member management
- Organization settings

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🐳 Docker Deployment

### Development
```bash
docker-compose up
```

### Production
```bash
# Build image
docker build -t real-estate-saas .

# Run container
docker run -p 5000:5000 --env-file .env real-estate-saas
```

## 📝 Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` - Redis server host
- `JWT_SECRET` - Secret for signing JWT tokens
- `SMTP_*` - Email service configuration
- `AWS_*` - AWS S3 configuration for file uploads

## 🔒 Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Refresh token rotation
- Rate limiting per IP
- CORS configuration
- Security headers (Helmet)
- Input validation & sanitization
- SQL/NoSQL injection prevention
- Audit logging for compliance

## 📈 Roadmap

- [x] Phase 1: Project Setup & Infrastructure
- [x] Phase 2: Authentication & Multi-tenancy
- [ ] Phase 3: Property Management CRUD
- [ ] Phase 4: Task/Lead Management
- [ ] Phase 5: Caching & Performance
- [ ] Phase 6: File Uploads
- [ ] Phase 7: Background Jobs
- [ ] Phase 8: Admin Dashboard
- [ ] Phase 9: Testing
- [ ] Phase 10: Deployment & CI/CD

## 🤝 Contributing

This is a personal hiring portfolio project. Feedback and suggestions are welcome!

## 📄 License

MIT License

## 👤 Author

**Divyanshu**
- GitHub: [@Divyanshu-23](https://github.com/Divyanshu-23)

---

Built with ❤️ for learning and demonstrating production-ready backend engineering skills.