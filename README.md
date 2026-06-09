# SolarScout V2 ☀️🛰️

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=flat-square&logo=vercel&logoColor=white&color=000000)](https://solar-scout-v2.vercel.app)
[![Vite](https://img.shields.io/badge/Vite-7.2.4-blue?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-emerald?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer--Vision-red?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compatible-blue?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

> **Next-generation, AI-driven solar feasibility analysis platform and premium CAD roof design workspace.**

SolarScout V2 is a production-grade, enterprise-ready monorepo combining state-of-the-art **Computer Vision (CV)**, **automated spatial CAD packing**, and a **dynamic financial model** to streamline rooftop solar estimation for homeowners, business owners, and regional solar installers.

Live Demo: [https://solar-scout-v2.vercel.app](https://solar-scout-v2.vercel.app)

---

## 📖 Table of Contents
1. [Why We Built This](#-why-we-built-this)
2. [Problem Statement](#-problem-statement)
3. [The Solution](#-the-solution)
4. [Tech Stack](#%EF%B8%8F-tech-stack)
5. [Core Features](#-core-features)
6. [Challenges Faced](#-challenges-faced)
7. [Scalability Vision](#-scalability-vision)
8. [Folder Structure](#-folder-structure)
9. [Deployment Architecture](#-deployment-architecture)
10. [API Documentation](#-api-documentation)
11. [Environment Variables](#-environment-variables)
12. [Quick Start & Setup](#-quick-start--setup)
13. [Security & Performance](#-security--performance)
14. [Roadmap](#-roadmap)
15. [Contributing](#-contributing)
16. [License & Contact](#-license--contact)

---

## 💡 Why We Built This

Rooftop solar estimation is historically broken. Traditional platforms suffer from **double-penalization math** (under-representing usable roof surfaces) and rely on legacy, mock rectangular envelopes that fail on complex architectural angles. 

To bridge this gap, we built SolarScout V2: a platform that merges satellite visual analysis with high-fidelity, real-time geometry. By placing standard **550W Monocrystalline Bifacial solar modules** ($2.28\text{m} \times 1.13\text{m}$) inside custom-drawn boundaries with precise spatial vector packing, we empower installers and homeowners to see exactly what fits, back it up with NREL-standard math, and generate multi-section PDF feasibility proposals in under 10 seconds.

---

## ⚠️ Problem Statement

*   **Underestimation Bias**: Legacy platforms apply arbitrary scaling factor overrides that reduce the estimated array footprint to a fraction of the actual roof space (e.g., estimating 8 panels where 24 panels physically fit).
*   **Drawing Tool Friction**: Drawing polygon lines on tiny roofs via mobile or trackpad is incredibly difficult. Map drag/zoom operations often conflict with point plotting, leading to premature polygon closure.
*   **Static Mock grids**: The industry lacks automated custom grid packing inside complex polygons. Installers rely on drawing simple rectangles, leading to visual clipping over eaves or gutters.

---

## 🛠️ The Solution

*   **NREL & MNRE Standard Math**: Standardized calculations on a physical-area-based model utilizing a 75%–80% usable area coefficient.
    $$\text{Panel Count} = \lfloor \frac{\text{Measured Roof Area} \times \text{Usable Ratio}}{2.58 \text{ m}^2} \rfloor$$
*   **Touch-Optimized Precision CAD Tools**: Introduced dynamic map interaction locks, pointer-event masks, and pixel-based (15px threshold) polygon vertices closing.
*   **FastAPI Computer Vision Satellite Segmentations**: Operates a secondary microservice that segments satellite imagery, processes tile masks using HSV-filters and contour detection, and outputs real geometric structures.
*   **Point-In-Polygon Array Packing**: Utilizes `Turf.js` to project physical arrays inside custom roof coordinates, verifying individual boundary containment inside the polygon.

---

## ⚙️ Tech Stack

### Visual Directory Layout
<p align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=typescript,react,vite,tailwind,nodejs,express,postgres,redis,python,fastapi,docker,figma" />
  </a>
</p>

### Frontend
- **Core**: React 18, Vite 7, TypeScript
- **Styling**: TailwindCSS, Framer Motion, Vanilla CSS (Glassmorphic panels)
- **Map CAD**: Leaflet, Turf.js (Spatial computations), Html2Canvas

### Backend (Express Gateway)
- **Runtime**: Node.js, TypeScript, Express, Prisma ORM
- **Task Queue**: BullMQ, Redis (Caching and asynchronous operations)
- **Authentication**: JWT, Firebase Admin Core (Leads collection integration)

### Computer Vision Service
- **Runtime**: Python 3.10+, FastAPI, Uvicorn
- **CV Libs**: OpenCV, NumPy, Pillow (PIL), Matplotlib

---

## 🚀 Core Features

### 1. Unified Computer Vision Segmentation
Communicates with the FastAPI microservice to capture satellite tiles, run OpenCV HSV color segmentation and contour analysis, identify existing physical solar panel arrays, and project boundary polygon lines onto the map.

### 2. High-Fidelity Individual Panel Projection
Renders realistic blue panel polygons representing individual 550W bifacial modules mapped accurately to scale ($2.28\text{m} \times 1.13\text{m}$) inside custom-drawn boundaries with customizable Portrait/Landscape toggles and a 5% maintainability spacing buffer.

### 3. Glassmorphic HITL Calibration Loop
A gorgeous, backdrop-blurred modal prompts users with: *"AI detected X panels. Did we miss any?"*. Using tactile steppers, installers can calibrate counts in real-time, instantly redrawing panel bounds on the Leaflet map at 60 FPS while logging the delta to a local JSON feedback loop.

### 4. Interactive Financial HUD & PDF Generator
Dynamic client side estimation that models setup costs (₹75k/kWp), PM Surya Ghar Yojana residential subsidies (capped at ₹78,000), annual solar yields, and payback breakeven timelines, compiled into a clean 4-page jsPDF client proposal.

---

## 🧠 Challenges Faced

*   **Trackpad Drift & Map Panning**: When developers or installers draw roof boundaries, micro-movements on mobile touch screens or trackpads triggered Leaflet dragging events instead of point additions. We solved this by freezing map drag-zooming during active CAD draw states.
*   **SPA Page Reload 404s**: Standard Vite deployments on Vercel lose context when users reload their browser on nested paths. We fixed this by introducing a strict `vercel.json` SPA routing rewrite exclusion rule that intercepts virtual paths while leaving assets uncompromised.
*   **Double-Penalization Calculation**: Addressed and corrected the calculation formulas in `HeroEstimator.tsx` and `DesignWorkspace.tsx`, removing the conflicting metrics that artificially capped panel estimates.

---

## 🔮 Scalability Vision

Our engineering architecture is structured for regional and cloud-scale growth:
```mermaid
graph TD
  User[Client Browser] -->|Vite Static Assets| Vercel[Vercel CDN]
  User -->|HTTP API Requests| Express[Node Express Gateway]
  Express -->|Job Tasks| Redis[Redis / BullMQ Queue]
  Redis -->|Workers| Simulation[Simulation Worker Cluster]
  Express -->|Postgres SQL| PG[PostgreSQL DB / Prisma]
  Express -->|Satellite Arrays| FastAPI[FastAPI CV Service]
  FastAPI -->|OpenCV Segmentations| ESRI[Esri Satellite GIS]
```

---

## 📂 Folder Structure

```
solar-scout-v2/
├── client/                     # Vite React Frontend Application
│   ├── public/                 # Static assets, SVG markers
│   ├── src/
│   │   ├── api/                # Axios configuration (VITE_API_URL)
│   │   ├── components/         # Map, CAD tools, Estimator, Results Modal
│   │   ├── layouts/            # Dashboard wrappers (Franchisee / Admin)
│   │   ├── pages/              # Lead management, Franchisee CAD Workspace
│   │   └── utils/              # solarMath.ts, pdfGenerator.ts
│   ├── vercel.json             # Vercel SPA routing rewrite configurations
│   └── package.json            
├── server/                     # Node.js Express Gateway
│   ├── prisma/                 # Database Schema (schema.prisma)
│   ├── src/
│   │   ├── controllers/        # Auth, Feasibility, Simulation endpoints
│   │   ├── data/               # feedback_learning_loop.json
│   │   ├── routes/             # Express API routing gateways
│   │   └── workers/            # BullMQ background task workers
│   └── package.json
├── detection_service/          # FastAPI Python CV Microservice
│   ├── main.py                 # OpenCV HSV Masking & Contour pipelines
│   └── requirements.txt        # python packages (opencv, pillow, fastapi)
└── docker-compose.yml          # Container stack orchestration (DB & Redis)
```

---

## 📡 API Documentation

### 1. Panel Detection Endpoint
Analyze user-drawn rooftop boundary and return the optimal packed grid array.

*   **URL**: `/api/detection/detect-panels`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json`
*   **Payload**:
```json
{
  "lat": 20.5937,
  "lng": 78.9629,
  "polygon": [
    { "lat": 20.5938, "lng": 78.9628 },
    { "lat": 20.5940, "lng": 78.9628 },
    { "lat": 20.5940, "lng": 78.9630 },
    { "lat": 20.5938, "lng": 78.9630 }
  ],
  "orientation": "portrait"
}
```
*   **Response (Success)**:
```json
{
  "success": true,
  "panelCount": 24,
  "capacityKW": 13.2,
  "polygons": [
    [
      { "lat": 20.5938, "lng": 78.9628 },
      { "lat": 20.5940, "lng": 78.9628 }
    ]
  ],
  "detectedPanels": []
}
```

### 2. HITL Feedback Loop
Log user-corrected calibration data to train and refine the computer vision thresholds.

*   **URL**: `/api/detection/detect-feedback`
*   **Method**: `POST`
*   **Payload**:
```json
{
  "lat": 20.5937,
  "lng": 78.9629,
  "polygon": [{ "lat": 20.5938, "lng": 78.9628 }],
  "aiDetectedCount": 18,
  "userCorrectedCount": 24,
  "missedCount": 6
}
```

---

## 🔑 Environment Variables

To run the services successfully, ensure the following keys are provided:

### Client Application (`client/.env`)
```env
# Backend API URL
VITE_API_URL="http://localhost:3000/api"

# Firebase SDK Client Keys
VITE_FIREBASE_API_KEY="AIzaSyA..."
VITE_FIREBASE_AUTH_DOMAIN="solarscout-22824.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="solarscout-22824"
VITE_FIREBASE_STORAGE_BUCKET="solarscout-22824.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="684037209200"
VITE_FIREBASE_APP_ID="1:684037209200:web:5342e045bdd96bfe0688b5"
VITE_FIREBASE_MEASUREMENT_ID="G-LRG5C0KH0R"
```

### Backend Gateway (`server/.env`)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/solar_scout?schema=public"
JWT_SECRET="supersecretkey_change_this_in_production"
PORT=3000
REDIS_HOST="localhost"
REDIS_PORT=6379
```

---

## ⚡ Quick Start & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Docker & Docker Compose
- Redis (Optional, runs in Docker)

---

### Step 1: Clone and Configure Core DB
```bash
# Clone the repository
git clone https://github.com/ajay-tummeti/solar-scout-v2.git
cd solar-scout-v2

# Start Postgres & Redis containers
docker-compose up -d
```

---

### Step 2: Spin Up the FastAPI Visual Engine
```bash
cd detection_service
python -m venv venv
source venv/Scripts/activate # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

---

### Step 3: Start Node/Express Server
```bash
cd ../server
npm install
npx prisma migrate dev --name init
npm run dev
```

---

### Step 4: Launch Vite React Application
```bash
cd ../client
npm install
npm run dev
```
Open your browser at `http://localhost:5175`.

---

## 🔒 Security & Performance

*   **CORS & JWT Guards**: All franchisee endpoints, PDF downloads, and CAD updates are protected behind JWT authentication middleware.
*   **Rate-Limiting Queues**: Dynamic estimation requests are queued through Redis/BullMQ, preventing DDoS on the OpenCV satellite fetching pipeline.
*   **SEO-Optimized HTML5 Canvas**: Map overlays are cached in React state, maintaining fluid 60 FPS leaflet vector re-render arrays.

---

## 🗺️ Roadmap

- [ ] **Q3 2026**: Fully autonomous CNN-based roof edge boundary extraction (no drawing tools required).
- [ ] **Q4 2026**: 3D LIDAR shading analysis integration, mapping tree canopy obstacle heights.
- [ ] **Q1 2027**: Regional Utility Net-Metering API connections for automated billing audits.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License & Contact

Distributed under the MIT License. See `LICENSE` for more information.

**Project Contact**: [Ajay Tummeti](https://github.com/ajay-tummeti)
<br />
**Production Deployment**: [https://solar-scout-v2.vercel.app](https://solar-scout-v2.vercel.app)
