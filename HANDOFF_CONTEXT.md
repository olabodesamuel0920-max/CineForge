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

## ⚠️ Where We Are Stuck (Critical Constraints)

If you are continuing work on this codebase, you must respect these platform constraints:

### 1. GCP Billing Limit (No Cloud Run Deploy)
* **Blocker**: The GCP project (`cineforge-render-497509`) lacks an attached billing account. Google Cloud Build and Cloud Run deployments are blocked.
* **Impact**: The worker **cannot** be deployed to Google Cloud Run. The environment **must run entirely on localhost** with local storage routes.
* **Resolution**:
  * Next.js running on `http://localhost:3000`
  * Express Render Worker running on `http://localhost:8080`
  * Set `RENDER_MODE=local` (or leave it undefined) in `.env.local` to trigger local directories instead of cloud GCS buckets.

### 2. No Local Docker Sandbox
* **Blocker**: The host machine runs WSL/Windows, and the Docker daemon cannot be started.
* **Impact**: We cannot build or run the `Dockerfile` locally for local sandbox verification.
* **Resolution**: All worker processes must run directly via node on the host (`npm run dev` inside `infrastructure/render-gcp`).

### 3. File Paths and Storage
* Uploads are saved directly to `public/uploads/` on the local file system.
* Completed renders are copied to `public/renders/` on the local file system.
* Next.js reads and writes projects to the database (or localStorage fallback if Supabase is unconfigured) and plays output videos directly from the `/renders/` route.

---

## 🏃 How to Run the App Locally

To start the local developer workspace:

### 1. Start the Render Worker (Port 8080)
```bash
cd infrastructure/render-gcp
npm install
npm run dev
```

### 2. Start the Next.js Frontend (Port 3000)
```bash
# In the root folder
npm install
npm run dev
```

### 3. Environment Setup (`.env.local` in root)
Ensure the following variables are configured for local operation:
```env
RENDER_MODE=local
RENDER_NODE_URL=http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
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
