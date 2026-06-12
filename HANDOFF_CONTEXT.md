# CineForge Project Handoff Context

This document provides a comprehensive overview of **CineForge** for ChatGPT and Claude. It outlines the project's architecture, what has been implemented, how to run it, and the current constraints/blockers where we are stuck.

---

## 🚀 Project Overview
CineForge is an advanced AI-powered video editing and rendering platform. It takes user-uploaded video clips and automatically compiles them into highly stylized, beat-synced vertical montages (reminiscent of high-energy automotive edits, such as BMW reels).

---

## 📐 System Architecture

The project is split into two primary components:

1. **Director (Next.js Web App - Port 3000)**
   * **Role**: Frontend UI, project management dashboard, and orchestration controller.
   * **Database**: Supabase PostgreSQL with Row Level Security (RLS) enabled.
   * **AI Planner**: Ingests uploaded video metadata (duration, resolution, etc.) and analyzes audio beat transients to generate a structured timeline blueprint using LLMs (Gemini/OpenAI).
   * **Stripe Billing**: Controls user credits (50 credits on upgrade), processes webhooks, and gates master renders behind a `402 Payment Required` credit check.
   * **Proxy Layer**: Forwards rendering requests to the worker and polls worker status, handling transient connection drops with retries.

2. **Worker (Express & FFmpeg Service - Port 8080)**
   * **Role**: Heavy-duty rendering, audio analysis, and video composition engine.
   * **DSP Audio Analyzer**: Runs transient detection on soundtracks to extract BPM and beat locations.
   * **Fracture Engine**: Slices conformed timeline sections into sub-segments aligning to audio transient beats. Slices are mapped to pseudo-random source video segments using a deterministic seed (`block.text + microClipIndex`) with bounds validation.
   * **Dynamic Velocity Ramping**: Accelerates (up to 4.0x) or slows down (down to 0.25x video slow-mo) segments to match audio pacing. Clamps audio speeds to `[0.5, 2.0]` via FFmpeg to prevent pitch collapse or filter crashes.
   * **Aesthetic Filters**: Implements custom teal-shadow/warm-highlight split-tone color balance, high contrast, sharpening, edge vignettes, and ducks soundtracks under primary video audio.

---

## 🛠️ Current Development State
The codebase is **100% type-safe** and compiles successfully on both Next.js and the Express Render Worker.

* **Frontend status endpoint resilient**: Polling in `RenderQueuePanel.tsx` handles up to 5 consecutive network drops, and the proxy endpoint retries 3 times before failing.
* **Structural burns filtered**: A regex helper filters out placeholder segment names (like `"Intro Narrative Hook"`) to keep titles clean.
* **Audio Speed Protections**: Audio processing is clamped, ensuring FFmpeg renders slow-mo/fast-mo without failing.
* **Dynamic URLs resolved**: The page details page resolves the active video URL to `/renders/output-${project.id}.mp4` once the rendering completes successfully.

---

## ☁️ Production Cloud Deployment (GCP & Vercel)

The app is now fully deployed in a hybrid cloud production environment, resolving all previous local development blockers:

### 1. Google Cloud Platform (GCP) Infrastructure
* **Active Project**: `cineforge-render-live-123456` (Billing Enabled)
* **Express Render Worker (Cloud Run)**: Deployed as `cineforge-worker-service`
  * **Endpoint**: `https://cineforge-worker-service-214796063144.us-central1.run.app`
  * **Configuration**: `CPU = 2`, `Memory = 2Gi`, `Max Instances = 1`, and **CPU always allocated** (`--no-cpu-throttling`) to ensure background FFmpeg jobs run at full speed without container throttling.
  * **Security**: API endpoints are hardened behind a secure custom header validation checking for `x-cineforge-worker-secret`. The root `/` health status is left public.
* **Google Cloud Storage (GCS)**: Bucket `gs://cineforge-render-assets-live-123456` (us-central1) stores the raw assets (`/raw/`) and outputs (`/rendered/`).
* **Firestore**: Native mode database (`nam5` multi-region) acts as the state store for transcode progress.
* **IAM**:
  * **Worker Service Account**: Compute Engine default (`214796063144-compute@developer.gserviceaccount.com`) has `roles/storage.admin`, `roles/artifactregistry.writer`, and `roles/iam.serviceAccountTokenCreator` (to allow v4 signed URL generation).
  * **Vercel Service Account**: `vercel-sa@cineforge-render-live-123456.iam.gserviceaccount.com` has `roles/storage.admin` and `roles/datastore.user` to read transcode state and generate presigned signed read URLs for clients on Vercel.

### 2. Vercel Next.js Frontend
* **Deploy URL**: `https://cine-forge.vercel.app`
* **Vercel project environment variables**:
  * `RENDER_MODE=cloud`
  * `RENDER_NODE_URL=https://cineforge-worker-service-214796063144.us-central1.run.app`
  * `GCS_BUCKET_NAME=cineforge-render-assets-live-123456`
  * `RENDER_WORKER_SECRET=<secure-secret-rotated-do-not-commit-in-plain-text>`
  * `GCP_PROJECT_ID=cineforge-render-live-123456`
  * `GCP_CLIENT_EMAIL=vercel-sa@cineforge-render-live-123456.iam.gserviceaccount.com`
  * `GCP_PRIVATE_KEY` (raw service account private key for GCS signing)

---

## 🏃 Running the App

### Running in Cloud/Production Mode
To update or deploy the production setup:
1. **Redeploy Next.js Frontend to Vercel**:
   ```bash
   npx vercel --prod
   ```
2. **Recompile/Redeploy Render Worker (GCP Cloud Build & Cloud Run)**:
   ```bash
   # In root directory, submit source code to Google Cloud Build
   gcloud builds submit --tag=us-central1-docker.pkg.dev/cineforge-render-live-123456/cineforge-repo/cineforge-worker:latest infrastructure/render-gcp
   
   # Deploy the compiled image to Cloud Run (with no-cpu-throttling)
   gcloud run deploy cineforge-worker-service --image=us-central1-docker.pkg.dev/cineforge-render-live-123456/cineforge-repo/cineforge-worker:latest --platform=managed --region=us-central1 --max-instances=1 --cpu=2 --memory=2Gi --allow-unauthenticated --no-cpu-throttling --set-env-vars="RENDER_MODE=cloud,GCS_BUCKET_NAME=cineforge-render-assets-live-123456,RENDER_WORKER_SECRET=<secure-secret-rotated-do-not-commit-in-plain-text>"
   ```

### Running in Local Mode (Fallback)
If running entirely on localhost is required:
1. Set `RENDER_MODE=local` in `.env.local` (root) and in `infrastructure/render-gcp` configuration.
2. Start the Render Worker:
   ```bash
   cd infrastructure/render-gcp
   npm run dev
   ```
3. Start the Next.js Web App:
   ```bash
   npm run dev
   ```

---

## 📁 Key File Map

Refer to these files when editing the core engine:
* **Frontend Project detail view**: [page.tsx](file:///c:/Users/colds/Documents/GitHub/CineForge/src/app/projects/%5Bid%5D/page.tsx)
* **Status Polling & UI**: [RenderQueuePanel.tsx](file:///c:/Users/colds/Documents/GitHub/CineForge/src/components/RenderQueuePanel.tsx)
* **Next.js Blueprint API**: [generate/route.ts](file:///c:/Users/colds/Documents/GitHub/CineForge/src/app/api/blueprint/generate/route.ts)
* **Next.js Status Proxy**: [status/[id]/route.ts](file:///c:/Users/colds/Documents/GitHub/CineForge/src/app/api/render/status/%5Bid%5D/route.ts)
* **Worker Server Entry**: [server.ts](file:///c:/Users/colds/Documents/GitHub/CineForge/infrastructure/render-gcp/server.ts)
* **FFmpeg Filter Compiler**: [ffmpeg.ts](file:///c:/Users/colds/Documents/GitHub/CineForge/infrastructure/render-gcp/ffmpeg.ts)

