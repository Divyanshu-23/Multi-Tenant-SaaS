# 🚀 Quick Start Guide - Running the Project

This guide will walk you through setting up and running the Multi-Tenant Real Estate SaaS Platform on your local machine.

---

## 📋 Prerequisites

Before you start, make sure you have the following installed:

### **Required Software:**
1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **MongoDB** (v6 or higher)
   - Option A: Install locally: https://www.mongodb.com/try/download/community
   - Option B: Use Docker (recommended)
   - Verify: `mongod --version`

3. **Redis** (v6 or higher)
   - Option A: Install locally: https://redis.io/download
   - Option B: Use Docker (recommended)
   - Verify: `redis-cli ping`

4. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

### **Optional but Recommended:**
- **Docker & Docker Compose** - For containerized services
  - Download: https://www.docker.com/products/docker-desktop
  - Verify: `docker --version`

---

## 🛠️ Installation Steps

### **Step 1: Navigate to Project Directory**
```bash
cd "C:\Users\divya\OneDrive\Documents\Personal Project\Multi Tenant SaaS Project"
```

### **Step 2: Install Dependencies**
```bash
npm install
```

This will install all required packages:
- express, mongoose, redis
- bcrypt, jsonwebtoken
- bull (for background jobs)
- nodemailer (for emails)
- multer (for file uploads)
- socket.io (for real-time features)
- And more...

### **Step 3: Set Up Environment Variables**

Create a `.env` file in the root directory:

```bash
# Create .env file
touch .env    # On Windows, use: type nul > .env
```

**Or manually create the file and add this content:**

```env
# Environment
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/real-estate-saas

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets (generate your own for production!)
JWT_ACCESS_SECRET=your-access-secret-key-here-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-here-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email (Optional - for testing, use Ethereal)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email
SMTP_PASS=your-ethereal-password
EMAIL_FROM="Real Estate SaaS <noreply@example.com>"

# App URL
APP_URL=http://localhost:5000
```

---

## 🐳 Option A: Running with Docker (Recommended)

The easiest way to run MongoDB and Redis is using Docker.

### **Step 1: Start MongoDB & Redis with Docker Compose**

Create `docker-compose.yml` in the root directory:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: real-estate-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    container_name: real-estate-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

### **Step 2: Start Services**
```bash
docker-compose up -d
```

### **Step 3: Verify Services are Running**
```bash
docker ps
```

You should see both `real-estate-mongodb` and `real-estate-redis` containers running.

---

## 💻 Option B: Running Services Locally

### **MongoDB (Local Installation)**

**Windows:**
1. Download MongoDB Community Server
2. Install with default settings
3. MongoDB should auto-start as a Windows service
4. Or start manually: `net start MongoDB`

**Verify:**
```bash
mongod --version
mongo --eval "db.version()"
```

### **Redis (Local Installation)**

**Windows:**
1. Download Redis for Windows: https://github.com/microsoftarchive/redis/releases
2. Extract and run `redis-server.exe`
3. Or install via WSL (Windows Subsystem for Linux)

**Verify:**
```bash
redis-cli ping
# Should return: PONG
```

---

## 🚀 Starting the Application

### **Step 1: Start MongoDB & Redis**

**If using Docker:**
```bash
docker-compose up -d
```

**If running locally:**
- Make sure MongoDB service is running
- Make sure Redis server is running

### **Step 2: Start the Node.js Server**

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### **Step 3: Verify Server is Running**

You should see output like:
```
✅ MongoDB Connected: localhost
✅ Redis Connected
📋 Queue event listeners setup: email
📋 Queue event listeners setup: taskReminder
📋 Queue event listeners setup: analytics
📋 Queue event listeners setup: cleanup
📧 Email worker started
⏰ Task reminder worker started
📊 Analytics worker started
🧹 Cleanup worker started
✅ Server running on port 5000
📄 Environment: development
🔗 API Base URL: http://localhost:5000
⚡ WebSocket URL: ws://localhost:5000

📚 Available endpoints:
   POST   /api/auth/register          - Register user
   POST   /api/auth/login             - Login user
   ...
```

---

## 🧪 Testing the API

### **Test Health Endpoint:**
```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Real Estate SaaS API is running",
  "timestamp": "2026-08-27T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

### **Test Welcome Endpoint:**
```bash
curl http://localhost:5000/
```

**Expected Response:**
```json
{
  "message": "Welcome to Real Estate SaaS API",
  "version": "1.0.0",
  "features": {
    "authentication": "JWT auth, registration, password reset",
    "multi_tenancy": "Organization-based data isolation",
    ...
  },
  "endpoints": {
    "auth": "/api/auth",
    "organizations": "/api/orgs",
    "properties": "/api/properties",
    "tasks": "/api/tasks"
  }
}
```

---

## 📝 Quick API Testing Workflow

### **1. Register a User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "Password123!",
    "phone": "+1234567890"
  }'
```

### **2. Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123!"
  }'
```

**Save the `accessToken` and `refreshToken` from the response!**

### **3. Create an Organization:**
```bash
curl -X POST http://localhost:5000/api/orgs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "My Real Estate Company",
    "description": "A property management company"
  }'
```

**Save the `organizationId` from the response!**

### **4. Create a Property:**
```bash
curl -X POST http://localhost:5000/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-organization-id: YOUR_ORG_ID" \
  -d '{
    "title": "Luxury Apartment",
    "description": "Beautiful 3BHK apartment with sea view",
    "propertyType": "apartment",
    "listingType": "sale",
    "price": 5000000,
    "location": {
      "address": "123 Ocean Drive",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "pincode": "400001"
    },
    "features": {
      "bedrooms": 3,
      "bathrooms": 2,
      "superArea": 1500,
      "coveredArea": 1200
    },
    "owner": {
      "name": "Jane Smith",
      "phone": "+9876543210",
      "email": "jane@example.com"
    }
  }'
```

### **5. List Properties:**
```bash
curl http://localhost:5000/api/properties \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-organization-id: YOUR_ORG_ID"
```

---

## 🔧 Common Issues & Solutions

### **Issue 1: MongoDB Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Ensure MongoDB is running: `docker-compose up -d`
- Or start MongoDB service locally
- Check MONGODB_URI in .env file

### **Issue 2: Redis Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
- Ensure Redis is running: `docker-compose up -d`
- Or start Redis server locally: `redis-server`
- Check REDIS_HOST and REDIS_PORT in .env file

### **Issue 3: Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
- Change PORT in .env file to another port (e.g., 5001)
- Or kill the process using port 5000:
  - Windows: `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`
  - Mac/Linux: `lsof -ti:5000 | xargs kill -9`

### **Issue 4: JWT Secret Errors**
```
JsonWebTokenError: invalid signature
```

**Solution:**
- Make sure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set in .env
- Use strong, random secrets in production

### **Issue 5: Module Not Found**
```
Error: Cannot find module 'bull'
```

**Solution:**
```bash
npm install
```

### **Issue 6: Multer Not Found**
```
Error: Cannot find module 'multer'
```

**Solution:**
```bash
npm install multer
```

---

## 📊 Monitoring the Application

### **Check Server Logs:**
The server logs all important events:
- Database connections
- Redis connections
- Queue status
- Job processing
- Errors and warnings

### **Check Queue Status:**
```bash
curl http://localhost:5000/api/queues \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "x-organization-id: YOUR_ORG_ID"
```

### **Check System Health:**
```bash
curl http://localhost:5000/api/admin/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "x-organization-id: YOUR_ORG_ID"
```

---

## 🛑 Stopping the Application

### **Stop Node.js Server:**
Press `Ctrl + C` in the terminal where the server is running.

### **Stop Docker Services:**
```bash
docker-compose down
```

### **Stop Docker Services & Remove Data:**
```bash
docker-compose down -v
```

---

## 📁 Project Structure

```
Multi Tenant SaaS Project/
├── src/
│   ├── config/           # Configuration files
│   │   ├── db.js         # MongoDB connection
│   │   ├── redis.js      # Redis connection
│   │   ├── queue.js      # Bull queue config
│   │   ├── socket.js     # Socket.IO setup
│   │   └── storage.js    # File storage
│   ├── middleware/       # Express middleware
│   │   ├── auth.js       # JWT authentication
│   │   ├── rbac.js       # Role-based access
│   │   ├── rateLimiting.js
│   │   └── errorHandler.js
│   ├── models/           # Mongoose schemas
│   │   ├── User.js
│   │   ├── Organization.js
│   │   ├── Property.js
│   │   └── Task.js
│   ├── routes/           # API endpoints
│   │   ├── authRoutes.js
│   │   ├── orgRoutes.js
│   │   ├── propertyRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── uploadRoutes.js
│   │   ├── queueRoutes.js
│   │   └── adminRoutes.js
│   ├── services/         # Business logic
│   │   └── emailService.js
│   ├── workers/          # Background job workers
│   │   ├── emailWorker.js
│   │   ├── taskReminderWorker.js
│   │   ├── analyticsWorker.js
│   │   └── cleanupWorker.js
│   ├── utils/            # Utility functions
│   │   ├── cache.js
│   │   └── fileUpload.js
│   └── index.js          # Main application
├── uploads/              # File storage (auto-created)
│   ├── properties/
│   ├── tasks/
│   ├── avatars/
│   └── documents/
├── .env                  # Environment variables
├── package.json
└── docker-compose.yml
```

---

## 🎯 Next Steps

After successfully running the project:

1. **Explore the API:**
   - Use Postman or Insomnia to test endpoints
   - Check the README.md for all available endpoints

2. **Test Features:**
   - Register users
   - Create organizations
   - Add properties
   - Create tasks
   - Upload files
   - Test real-time features with Socket.IO

3. **Check Background Jobs:**
   - Send test emails
   - Trigger cleanup jobs
   - Check queue status

4. **Monitor Performance:**
   - Check Redis caching
   - Monitor queue processing
   - Test rate limiting

---

## 📞 Need Help?

If you encounter any issues:

1. **Check the logs** - Server logs provide detailed error messages
2. **Verify .env file** - Ensure all required variables are set
3. **Check service status** - Make sure MongoDB and Redis are running
4. **Review documentation** - Check README.md and phase completion docs

---

## 🎉 You're All Set!

The server should now be running at:
- **API:** http://localhost:5000
- **WebSocket:** ws://localhost:5000

Start building and testing your Real Estate SaaS Platform! 🚀