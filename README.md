# NeuroScan AI: Enterprise Brain MRI & Clinical Decision Support System

NeuroScan AI is a clinical-grade Web platform designed for brain MRI analysis, multi-class dementia classification, explainable AI heatmap visualisations, and assistant-guided diagnosis workflows.

---

## 1. System Architecture

Below is the conceptual architecture showing how NeuroScan AI couples React client state, FastAPI router lifecycle, TensorFlow prediction engine, and PostgreSQL/Supabase database tables.

```mermaid
graph TD
    %% Frontend Layer
    A["React Client SPA (Vite)"] -->|JWT Bearer Token| B["FastAPI Application Gateway"]
    A -->|RAG Prompts & TTS / STT| C["JEMMI AI Copilot UI"]
    
    %% API Services Layer
    subgraph FastAPI Backend App
        B --> D["lifespan context lifecycle"]
        D -->|DB Connection Pool| E["PostgreSQL / Supabase Driver"]
        D -->|RAG Ingestion| F["Offline Medical RAG Index"]
        D -->|Prediction Pipeline| G["TensorFlow Model Engine"]
    end
    
    %% Storage & External APIs Layer
    subgraph Data & AI Infrastructure
        E -->|Store Scans, Notes & Audit logs| H[("PostgreSQL Database")]
        C -->|Secure streaming prompts| I["Gemini & Groq APIs"]
        F -->|Fetch clinical templates| J[("Local RAG Markdown Store")]
    end
```

---

## 2. Core API Endpoint Documentation

### Authentication & User Management
*   `POST /api/v1/auth/register`: Create a new clinician/patient account.
*   `POST /api/v1/auth/login`: Authenticate credentials and return a secure JWT bearer access token.
*   `POST /api/v1/auth/logout`: Invalidate user sessions.
*   `GET /api/v1/users/me`: Query details of the currently logged-in account.

### Patient Profile Management
*   `GET /api/v1/profile`: Retrieve patient demographics, allergies, height, weight, BMI, and emergency contacts.
*   `POST /api/v1/profile`: Create a patient record and assign a unique Patient ID (`NSA-XXXX`).
*   `PUT /api/v1/profile`: Update existing profile data and validate inputs.

### MRI Upload & Diagnostics Workstation
*   `POST /api/v1/mri/upload`: Upload NIfTI/DICOM/PNG brain scans (validate size limit, MIME-type, and generate predictions).
*   `GET /api/v1/mri/scans`: List all uploaded MRI history scans for the active user.
*   `GET /api/v1/mri/scans/{scan_id}`: Retrieve detailed analysis prediction, confidence gauges, and affected brain regions.
*   `GET /api/v1/mri/heatmap/{scan_id}`: Fetch explainability pixel coordinate overlays mapping to classified dementia indicators.

### Clinical Reports
*   `GET /api/v1/reports`: List all generated patient reports.
*   `GET /api/v1/reports/{report_id}/pdf`: Stream/download a signature-authenticated PDF report containing clinic letterheads.

### JEMMI AI Copilot
*   `GET /api/v1/assistant/sessions`: List active chat conversations.
*   `POST /api/v1/assistant/sessions`: Create a new session initialized with the active patient context.
*   `PUT /api/v1/assistant/sessions/{id}`: Rename, pin (favorite), or archive a conversation.
*   `GET /api/v1/assistant/stream`: True token-by-token SSE streaming response channel.

### System Diagnostics
*   `GET /health`: Supabase database, storage bucket, and server health checks.

---

## 3. Database Schema Design

The PostgreSQL storage layer consists of the following primary tables:

1.  **`users`**: Stored user registrations, password hashes, and user roles (`patient`, `doctor`, `admin`).
2.  **`patients`**: Stores patient profile fields including demographic attributes (DOB, blood group) and clinical indicators (allergies, current medications, previous surgeries).
3.  **`mri_scans`**: Tracks uploaded scans, file paths, prediction classes (`Non Demented`, `Mild Demented`), confidence scores, and affected brain lobes.
4.  **`reports`**: Links MRI scans with medical reports and signatures.
5.  **`doctor_notes`**: Supports multiple notes timeline logs per scan ID containing observation feedback.
6.  **`user_settings`**: Persists layout themes, preferred languages (English, Telugu, Hindi), notifications, high contrast accessibility mode, and JEMMI voice speeds.
7.  **`audit_logs`**: Logs all clinical actions (MRI uploads, report prints, settings changes) with request IPs for auditing.

---

## 4. Local Installation & Development Setup

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   PostgreSQL database instance

### Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install Python packages:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure environmental variables inside a `.env` file:
    ```env
    DATABASE_URL=postgresql://user:password@localhost:5432/neuroscan
    JWT_SECRET=supersecretkey
    GEMINI_API_KEY=yourkey
    ```
4.  Launch the FastAPI server:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```

### Frontend Setup
1.  Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Run the Vite development server:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:5173` in your browser.

---

## 5. Deployment Guide

### Environment Configuration
When deploying to production environments, configure externalized variables:
*   `ENV=production`
*   `PORT=80`
*   `CORS_ORIGINS=["https://app.neuroscan.ai"]`
*   Disable backend debug mode to prevent traceback exposures in JSON error responses.

---

## 6. User & Administrator Manual

### Patient Dashboard
*   Patients log in to see a simplified view of their scan history.
*   Allows patient profile modification, download links for clinical PDF reports, and chat interactions with JEMMI AI for educational purposes.

### Doctor Workstation
*   Doctors access the PACS workstation displaying side-by-side MRI scans and activation heatmaps.
*   Enables doctors to write observations and sign off reports.

### System Administrator Console
*   Administrators view audit trail system logs, track active clinician database sessions, and monitor API server response times.
