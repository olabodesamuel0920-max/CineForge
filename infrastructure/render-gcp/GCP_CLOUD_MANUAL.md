# CineForge GCP Render Node: Setup & Deployment Manual

This manual explains how to set up your Google Cloud Platform (GCP) account, configure GCS Buckets and Firestore database registers, and deploy the **CineForge Render Node** container to **Google Cloud Run**.

---

## ☁️ Step 1: Open Google Cloud & Create a Project

Google Cloud Console is your central management dashboard.

1.  **Open Google Cloud Console**:
    *   Navigate to [console.cloud.google.com](https://console.cloud.google.com/) in your browser.
    *   Sign in with your Google account. (If you don't have a GCP account, follow the prompts to sign up. Google usually offers a $300 free trial credit).
2.  **Create a New Project**:
    *   In the top menu bar, click on the **Project Select dropdown** (next to the "Google Cloud" logo).
    *   Click **New Project** in the top right of the modal.
    *   Set **Project name**: `CineForge-Render` (or any name you prefer).
    *   Click **Create**.
    *   Once created, select the project in the top project dropdown.
3.  **Activate Billing**:
    *   Click the **Hamburger menu (☰)** in the top-left corner $\rightarrow$ click **Billing**.
    *   Ensure your project is linked to an active Billing Account. (Cloud Run requires an active billing account, but you will stay well within the free tier for short-form renders).

---

## 🔑 Step 2: Enable Required GCP APIs

To deploy and run container services, we need to activate a few APIs.

1.  Go to the **API & Services Dashboard**:
    *   Hamburger menu (☰) $\rightarrow$ **APIs & Services** $\rightarrow$ **Library**.
2.  Search for and click **Enable** on the following APIs:
    *   **Cloud Run API** *(runs the serverless container)*
    *   **Cloud Build API** *(compiles the Docker image on GCP)*
    *   **Google Cloud Storage API** *(file upload/downloads)*
    *   **Google Cloud Firestore API** *(logs progress tracking)*

---

## 🗄️ Step 3: Create GCS Storage Buckets

We need buckets to store the raw uploaded clips and output rendered videos.

1.  Go to **Cloud Storage**:
    *   Hamburger menu (☰) $\rightarrow$ **Cloud Storage** $\rightarrow$ **Buckets**.
2.  Click **Create**:
    *   **Bucket Name**: `cineforge-media-bucket` *(Note: Bucket names must be globally unique across GCP)*.
    *   **Location Type**: Select **Region** $\rightarrow$ choose a region close to your users (e.g. `us-east1` or `us-central1`).
    *   **Storage Class**: Select **Standard**.
    *   **Access Control**: Select **Uniform**.
    *   Uncheck **Enforce public access prevention on this bucket** if you want to allow downloading via presigned URLs without custom IAM logins.
3.  Click **Create**.
4.  *(Optional)* Create two folders inside this bucket: `raw/` (for raw uploads) and `rendered/` (for output videos).

---

## 🛢️ Step 4: Configure Firestore Database

1.  Go to **Firestore**:
    *   Hamburger menu (☰) $\rightarrow$ **Firestore**.
2.  Click **Create Database**:
    *   Select **Native Mode** *(recommended for real-time mobile/web app state updates)*.
    *   **Database ID**: Select `(default)`.
    *   **Location**: Select the same region as your storage bucket (e.g., `us-east1`).
3.  Click **Create Database**. (Firestore will initialize. You do not need to create tables or collections manually—Firestore creates the `CineForgeProgress` collection dynamically when the code writes the first log).

---

## 🚀 Step 5: Deploy to Google Cloud Run

You can deploy the service using the **gcloud CLI** on your machine or directly through the **GCP Web Console UI** connected to your GitHub repository.

### Option A: Deploy via `gcloud` CLI (Fastest from terminal)
If you have the Google Cloud SDK installed locally, run:

```bash
cd infrastructure/render-gcp

# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Configure project
gcloud config set project [YOUR_PROJECT_ID]

# 3. Build and deploy container directly to Cloud Run
gcloud run deploy cineforge-render-node \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900
```
*(Cloud Run will compile the container using Cloud Build and deploy it. It will return a public HTTP URL like `https://cineforge-render-node-xxxx.a.run.app` when finished!)*

---

### Option B: Deploy via GCP Web Console UI (No CLI needed)
1. Push your repository to **GitHub**.
2. Go to **Cloud Run** in the GCP Console:
   * Hamburger menu (☰) $\rightarrow$ **Cloud Run** $\rightarrow$ click **Create Service**.
3. Set the configurations:
   * Select **Deploy one revision from a source repository**.
   * Click **Set up Cloud Build** $\rightarrow$ Connect to **GitHub** and select your repository.
   * Select your branch, set Build type to **Dockerfile**, and click **Save**.
   * **Service name**: `cineforge-render-node`
   * **Region**: `us-east1`
   * **CPU allocation**: Select **CPU is always allocated** *(recommended for video processing stability)*.
   * **Autoscaling**: Min instances `0`, Max instances `3` (prevents cold starts and stays within free tiers).
   * **Ingress**: Select **Allow all traffic**.
   * **Authentication**: Select **Allow unauthenticated invocations**.
4. Click **Container(s), Volumes, Connections, Security** (advanced settings dropdown):
   * **Container Port**: `8080`
   * **Memory**: **4 GiB** *(vital for 60fps video frames)*
   * **CPU**: **2 vCPU**
   * **Request timeout**: **900 seconds** (15 minutes)
   * **Environment variables**:
     * `PROGRESS_COLLECTION_NAME` = `CineForgeProgress`
5. Click **Create**. Google Cloud will automatically pull your code, run the Docker build, package FFmpeg, and provision your endpoint URL!
