# Deployment Guide — LiquidityIQ

LiquidityIQ is built with a **React SPA frontend** and a **FastAPI (Python) ML backend** with MongoDB and WebSocket streaming.

This guide walks you through deploying the **Frontend to Vercel** and connecting it with your **Backend**.

---

## 1. Deploying the Frontend to Vercel

The repository is now pre-configured for seamless Vercel deployment. Both root-level and `frontend/` directory setups are supported out of the box with SPA routing rewrites and build configurations.

### Method A: Deploy via Vercel Dashboard (Recommended)

1. Push your code to your GitHub, GitLab, or Bitbucket repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"** > **"Import"** your repository.
3. Configure your project:
   - **Framework Preset**: Create React App (detected automatically)
   - **Root Directory**:
     - You can leave it as `./` (the root `vercel.json` handles building `frontend/` and mapping output to `frontend/build`), **OR**
     - Select `frontend` as the Root Directory (the `frontend/vercel.json` handles SPA routes).
4. In **Environment Variables**, add:
   - `REACT_APP_BACKEND_URL`: `https://<your-deployed-backend-url>` (e.g., `https://liquidityiq-api.onrender.com`)
5. Click **Deploy**.

### Method B: Deploy via Vercel CLI

Run the following command from the root directory:

```bash
# Preview deployment
npx vercel

# Production deployment
npx vercel --prod
```

Or deploy directly from the frontend directory:

```bash
cd frontend
npx vercel --prod
```

---

## 2. Deploying the Backend (FastAPI + MongoDB)

> **Why not deploy the backend as Vercel Serverless Functions?**
> The backend features real-time WebSocket price streaming (`/api/ws/prices`), persistent MongoDB connections, and ML dependencies (`scikit-learn`, `statsmodels`, `pandas`, `scipy`) that exceed serverless timeout and bundle limits. It is designed to run on a persistent container or web service such as **Render**, **Railway**, **Fly.io**, or **DigitalOcean**.

### Deploy on Render (Recommended & Free tier available)

1. Create a free account at [render.com](https://render.com).
2. Create a new **Web Service** connected to your repository.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Set the following **Environment Variables**:
   - `MONGO_URL`: Your MongoDB connection URI (e.g., free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas))
   - `DB_NAME`: `liquidity_db`
   - `JWT_SECRET`: A secure random secret string
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
   - `ENV`: `production`
5. Click **Create Web Service**. Once deployed, copy your backend URL and paste it into Vercel's `REACT_APP_BACKEND_URL` environment variable.

---

## 3. Configuration & Files Reference

- [vercel.json](file:///Users/sayali/Downloads/liquidity-main/vercel.json): Configures root deployment, builds `frontend`, maps `frontend/build`, and handles SPA rewrites (`/(.*)` -> `/index.html`).
- [frontend/vercel.json](file:///Users/sayali/Downloads/liquidity-main/frontend/vercel.json): Ensures SPA client-side route rewrites if Vercel is pointed directly to `frontend/`.
- [.vercelignore](file:///Users/sayali/Downloads/liquidity-main/.vercelignore): Ignores Python environments and backend assets so deployments are fast and lightweight.
- [frontend/package.json](file:///Users/sayali/Downloads/liquidity-main/frontend/package.json): Updated with `CI=false craco build` so ESLint warnings never halt CI builds on Vercel.
- [backend/server.py](file:///Users/sayali/Downloads/liquidity-main/backend/server.py): Configured with CORS support for multiple origins and `*.vercel.app` preview domains.
