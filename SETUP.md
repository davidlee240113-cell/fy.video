# fy.video — Quick Start Guide

## Option A: Test Locally with Docker (Recommended)

### What You Need
- **Docker Desktop** — download free from https://docker.com/products/docker-desktop/

### Steps

1. **Install Docker Desktop** and make sure it's running (you'll see the whale icon in your taskbar/menu bar)

2. **Open a terminal** (on Mac: Terminal app, on Windows: PowerShell or Command Prompt)

3. **Navigate to this folder:**
   ```
   cd path/to/fy.video
   ```

4. **Run this single command:**
   ```
   docker-compose -f docker-compose.test.yml up
   ```

5. **Wait** — first run takes 2-3 minutes to download and install everything. You'll see lots of text scrolling. When you see:
   ```
   ✅ Database ready with demo data!
   🎬 Starting fy.video API on port 3001...
   🌐 Starting fy.video frontend on port 3000...
   ```
   ...it's ready!

6. **Open your browser** and go to: **http://localhost:3000**

### Demo Accounts

| Role    | Email                  | Password       | What You Can Do                        |
|---------|------------------------|----------------|----------------------------------------|
| Admin   | admin@fy.video         | admin123456    | See platform admin dashboard           |
| Creator | creator@example.com    | creator123456  | Manage series, view revenue, upload    |
| Viewer  | viewer@example.com     | viewer123456   | Browse, watch free episodes            |

### API Documentation
Open **http://localhost:3001/docs** to see all API endpoints with interactive testing.

### To Stop
Press **Ctrl+C** in the terminal, then run:
```
docker-compose -f docker-compose.test.yml down
```

---

## Option B: Deploy to Railway (Get a Public URL)

Railway gives you a free public URL so anyone can access your test site.

### Steps

1. Go to **https://railway.app** and sign up (free, use GitHub login)

2. Click **"New Project"** → **"Deploy from GitHub repo"**

3. Connect your GitHub and select the **fy.video** repository

4. Railway will detect the project. You need to add these services:
   - Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - Click **"+ New"** → **"Database"** → **"Add Redis"**

5. Click on your main service and go to **Variables** tab. Add these:
   ```
   DATABASE_URL        = (copy from PostgreSQL service)
   REDIS_URL           = (copy from Redis service)
   JWT_SECRET          = any-random-string-at-least-32-characters-long
   JWT_REFRESH_SECRET  = another-random-string-at-least-32-characters
   STRIPE_SECRET_KEY   = sk_test_placeholder
   STRIPE_WEBHOOK_SECRET = whsec_placeholder
   APP_URL             = (your Railway public URL, e.g., https://fyvideo.up.railway.app)
   API_URL             = (same as APP_URL)
   PORT                = 3001
   NODE_ENV            = production
   ```

6. Click **Deploy** and wait ~3 minutes

7. Railway will give you a public URL like `https://fyvideo-production.up.railway.app`

---

## Option C: Deploy to Render (Alternative)

1. Go to **https://render.com** and sign up (free)
2. Click **"New +"** → **"Web Service"** → connect GitHub repo
3. Render will auto-detect the Dockerfile
4. Add the same environment variables listed in Option B
5. Click **"Create Web Service"**

---

## What Works Without Stripe

Almost everything works in test mode without real Stripe keys:
- Browsing series and episodes
- User registration and login
- Creator dashboard
- Affiliate link generation
- Series and episode management
- Analytics dashboards

**What won't work** without real Stripe keys:
- Actual payment processing (purchases will show errors)
- Stripe Connect onboarding for creators

To test payments, create a free Stripe account at https://stripe.com and use the test mode keys.

---

## Project Structure

```
fy.video/
├── apps/
│   ├── api/          ← Backend server (port 3001)
│   │   ├── prisma/   ← Database schema & seed data
│   │   └── src/      ← API routes, services, middleware
│   └── web/          ← Frontend website (port 3000)
│       └── src/      ← Pages, components, styles
├── packages/
│   └── shared/       ← Shared types and utilities
├── docker-compose.test.yml  ← One-command test setup
└── docker-compose.yml       ← Production Docker setup
```
