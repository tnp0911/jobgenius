  ![Forks](https://img.shields.io/github/forks/tnp0911/jobgenius.svg?style=for-the-badge)
  ![Stargazers](https://img.shields.io/github/stars/tnp0911/jobgenius.svg?style=for-the-badge)
  ![Issues](https://img.shields.io/github/issues/tnp0911/jobgenius.svg?style=for-the-badge)
  ![project_license](https://img.shields.io/github/license/tnp0911/jobgenius?style=for-the-badge)
  ![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2.svg?style=for-the-badge&logo=linkedin&logoColor=white)

![Logo](images/logo.png)

### JobGenius

### AI Resume Analyzer & Intelligent Job Recommender System

  ![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue.svg)
  [Report Issue](https://github.com/tnp0911/jobgenius/issues/new)

**Table of Contents**  


| Overview                                | Setup                                       | Reference                               |
| --------------------------------------- | ------------------------------------------- | --------------------------------------- |
| [About The Project](#about-the-project) | [Getting Started](#getting-started)         | [Project Structure](#project-structure) |
| [Features](#features)                   | [Device Requirements](#device-requirements) | [Roadmap](#roadmap)                     |
| [Demo](#demo)                           | [Prerequisites](#prerequisites)             | [License](#license)                     |
| [Technologies](#technologies)           | [Installation](#installation)               | [Acknowledgements](#acknowledgements)   |
|                                         | [Usage](#usage)                             |                                         |
|                                         | [Configuration](#configuration)             |                                         |


## About The Project

### Project Disclaimer

JobGenius is a personal software engineering and learning project developed for educational, portfolio, and experimentation purposes. It demonstrates the design and implementation of a full-stack, AI-powered career platform using technologies such as microservices, LLMs, vector search, authentication, payments, and containerized infrastructure.

The application is under active development and is not intended to be a production-ready commercial service. Features, pricing, integrations, and implementation details may change without notice.

We are not responsible for any loss, damage, inaccurate information, employment decisions, financial decisions, or other consequences arising from the use of this software or its generated content. AI-generated recommendations, job information, resume analysis, career suggestions, and other outputs may contain errors, omissions, or outdated information and should be independently verified before being relied upon.

JobGenius does not guarantee employment, interview opportunities, job placement, resume performance, or the accuracy or availability of third-party job listings and services. Third-party APIs, services, payment providers, AI models, and other integrations are subject to their own availability, terms, limitations, and privacy policies.

This project is provided for demonstration and learning purposes on an "as is" and "as available" basis, without warranties of any kind, to the extent permitted by applicable law.

---

 JobGenius is a privacy-first, AI-powered career platform that helps job seekers get honest, actionable resume feedback and discover roles that genuinely match their experience — all without sending personal data to third-party cloud AI providers.

### The Problem

Most job seekers face two broken choices: generic resume builders that churn out cookie-cutter documents, or endless job boards that bury relevant openings under thousands of irrelevant listings. Neither gives you a clear signal on *why* your resume works or doesn't, and neither respects your data.

### The Solution

JobGenius acts as a sharp, impartial career mentor. Upload your resume (and optionally a target job posting), and a multi-agent AI pipeline will:

1. **Parse & understand** your document — extracting sections, skills, experience timelines, certifications, languages, and professional links using deterministic regex-based NLP (zero hallucination risk).
2. **Score your resume** with a weighted ATS scoring engine that simulates real recruiter heuristics — evaluating section completeness, metrics density, skill quality, experience depth, and job-description fit.
3. **Rewrite & optimize** *(Premium)* — an LLM-driven optimizer restructures bullets, integrates missing keywords, and strengthens your narrative while strictly preserving factual accuracy (no fabricated employers, degrees, or metrics).
4. **Coach you** — a finalizer agent delivers personalized feedback: executive-level recruiter lens evaluation,competitive market positioning, and a priority action plan.
5. **Find matching jobs** *(Premium)* — an autonomous agent formulates location-aware search queries, retrieves real-time listings via MCP tool calls, indexes them into a vector database, and explains why each role fits your profile.

## Features

### 🔍 Resume Analysis

- **Section detection** — automatically identifies Summary, Skills, Education, Experience, Projects, Certifications, Languages, and Volunteer sections
- **Skill extraction** — matches your hard and soft skills against a built-in taxonomy of IT, business, and interpersonal skills
- **Experience estimation** — parses date ranges and duration phrases to calculate total years of experience
- **Metrics scoring** — evaluates how well your bullets use quantified results (percentages, dollar amounts, numbers)
- **Job description gap analysis** — compares your skills against a target posting and highlights what's missing

### 📊 ATS Scoring Engine

- **Resume quality score** — weighted evaluation across sections (20%), metrics (20%), experience (30%), skills (15%), summary (10%), and formatting (5%)
- **ATS fit score** — when a job description is provided, calculates match based on hard skills (50%), soft skills (15%), experience (25%), and resume quality (10%)
- **Premium bonuses** — extra credit for verified certifications, foreign languages, portfolio links, and volunteer work

### ✍️ Resume Optimizer *(Premium)*

- Rewrites and restructures bullet points, summaries, and skills sections to align with your target role
- Integrates missing keywords from the job description naturally into your content
- **Strict factual guardrails** — never fabricates employers, degrees, dates, or metrics

### 🎯 Career Coaching Feedback

- **Free tier** — concise summary, section-by-section breakdown, and up to 5 actionable tips
- **Premium tier** — executive recruiter lens evaluation, STAR-method interview talking points, competitive market positioning, and a prioritized weekly action plan

### 💼 Job Recommendations

- **Guest users** — location-based openings detected via IP geolocation, cached for 15 days
- **Free users** — role and seniority-matched listings based on your analyzer results, cached for 10 days
- **Premium users** — semantic vector search against your stored resume with geographic tiering (local → national → international), cached for 3 days

### 🤖 AI Job Finder *(Premium)*

- Conversational prompt search — upload your resume and describe what you're looking for in plain language
- Autonomous agent builds search queries, fetches real-time listings via MCP, and explains why each role fits
- Discovered jobs are automatically indexed into the vector database for future recommendations

### 🔐 Authentication & Accounts

- Email/password registration with BCrypt hashing
- Google OAuth 2.0 single sign-on with automatic account merging
- Secure HttpOnly JWT cookies (15-min access + 7-day refresh tokens)
- Automatic token refresh on tab refocus with smart throttling

### 💳 Subscription & Billing

- **Free tier** — 2 anonymous analyses/month, 3 authenticated analyses/week, 1 prompt search every 15 days
- **Premium tier (CAD 20/mo)** — 3 analyses/day, prompt search every 3 days, full optimizer + coaching + job finder
- 14-day free trial on first subscription
- Stripe-powered checkout with webhook-driven lifecycle management
- Self-serve cancellation at any time

### 🛡️ Privacy First

- All AI runs locally via Ollama — no resume data sent to external cloud providers
- Resume PDFs stored in your own S3 (LocalStack for dev) with SHA-256 deduplication
- Non-root Docker containers for both backend services
- Distributed rate limiting protects against abuse without tracking authenticated users

## Demo

![JobGenius Home Page](https://github.com/user-attachments/assets/2dc03abe-9785-4254-b61a-c4984e83d9b4)

*Landing page — discover what JobGenius can do and jump straight into the analyzer*

![JobGenius Resume Analyzer](https://github.com/user-attachments/assets/4ab1ddf5-ad26-4185-8f82-4a8abd72d6e6)

*Resume Analyzer — upload your PDF, optionally paste a job description and career goal, then hit Analyze*

![JobGenius Waiting for Analysis](https://github.com/user-attachments/assets/051865e0-11ff-4123-83f9-e7bbff6a1e80)

*Processing — the multi-agent AI pipeline parses, scores, and coaches in real time*

![JobGenius Analysis Results](https://github.com/user-attachments/assets/1452cb2f-1047-445e-9248-1ef66179349c)

*Results dashboard — ATS score breakdown, skill gap analysis, and actionable coaching tips at a glance*

## Technologies


| Category                                                                                       | Technologies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**                                                                                   | ![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white) ![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)                                                                                                                                         |
| **API Server** [README](https://github.com/tnp0911/jobgenius/blob/main/api_server/README.md)   | ![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI_0.135-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white) ![Pydantic](https://img.shields.io/badge/Pydantic_v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white) ![Uvicorn](https://img.shields.io/badge/Uvicorn-2F4F4F?style=for-the-badge&logo=gunicorn&logoColor=white) ![ARQ](https://img.shields.io/badge/ARQ-Worker_%26_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)                        |
| **Auth Server** [README](https://github.com/tnp0911/jobgenius/blob/main/auth_server/README.md) | ![Java](https://img.shields.io/badge/Java_17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.2.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white) ![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white) ![Apache Maven](https://img.shields.io/badge/Apache_Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white) ![Hibernate](https://img.shields.io/badge/Hibernate-59666C?style=for-the-badge&logo=hibernate&logoColor=white) ![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white) |
| **AI & ML**                                                                                    | ![LangChain](https://img.shields.io/badge/LangChain-7FC8FF?style=for-the-badge&logo=langchain&logoColor=white) ![LangGraph](https://img.shields.io/badge/LangGraph-7FC8FF?style=for-the-badge&logo=langgraph&logoColor=white) ![FastMCP](https://img.shields.io/badge/FastMCP-Job_Finder_Tools-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white) ![Qwen 2.5 7B](https://img.shields.io/badge/Qwen_2.5_7B-7C3AED?style=for-the-badge&logoColor=white) ![Nomic](https://img.shields.io/badge/Nomic_Embed_v2-4B5563?style=for-the-badge&logoColor=white)                                          |
| **Databases & Storage**                                                                        | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) ![Pinecone](https://img.shields.io/badge/Pinecone-000000?style=for-the-badge&logoColor=white) ![Amazon S3](https://img.shields.io/badge/Amazon_S3-569A31?style=for-the-badge&logo=amazons3&logoColor=white)                                                                                                                                                                                  |
| **Infrastructure**                                                                             | ![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![LocalStack](https://img.shields.io/badge/LocalStack-4B4DD3?style=for-the-badge&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white) ![OAuth 2.0](https://img.shields.io/badge/OAuth_2.0-EB5424?style=for-the-badge&logo=auth0&logoColor=white)                                                                                                                                                                                                                                                                           |


## Getting Started

Follow these steps to set up the project locally. The system relies on Docker to orchestrate all services seamlessly.

### Device Requirements

Running local AI models and 10+ microservices requires significant local resources:


| Component   | Minimum Requirement          | Recommended                   |
| ----------- | ---------------------------- | ----------------------------- |
| **RAM**     | 8 GB allocated to Docker     | 16 GB+                        |
| **CPU**     | 4 Cores                      | 8 Cores+                      |
| **Storage** | ~12 GB free space for images | SSD for faster DB/Cache I/O   |
| **GPU**     | None (CPU inference)         | NVIDIA GPU (speeds up Ollama) |


### Prerequisites

Ensure you have the following installed before proceeding:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (v4.20+ recommended)
- **[Git](https://git-scm.com/)**
- **[Node.js](https://nodejs.org/en)** (v20+ for the frontend client)
- **[Python](https://www.python.org/)** (v3.11+ for local API testing, optional)
- **[Java 17](https://adoptium.net/)** (for local Spring Boot testing, optional)

### Installation

**1. Clone the repository**

```sh
git clone https://github.com/tnp0911/jobgenius.git
cd jobgenius
```

**2. Configure Environment Variables**

```sh
cp .env.example .env
cp api_server/.env.example api_server/.env
cp auth_server/.env.example auth_server/.env
```

**Note**: *Ensure you fill out any critical keys like* `STRIPE_SECRET_KEY` *or* `JWT_SECRET_KEY` *in the respective* `.env` *files.*

**3. Launch the Infrastructure**

Make sure the Docker Engine is running, then execute:

```sh
docker compose up -d --build
```

*This will build the application images (API Server, Auth Server, Background Worker), pull the necessary images, and start all services with detached mode.*

```sh
docker compose up -d
```

*This will pull the necessary images, and start all services with detached mode.*

Learn more about Docker commands in the [Docker CLI Cheatsheet](https://docs.docker.com/get-started/docker_cheatsheet.pdf).

**4. Start the Frontend Client**

```sh
cd client
npm install
npm run dev
```

**5. Access the Application**
Once everything is running, you can access the services at:

- **Client App**: [http://localhost:3000](http://localhost:3000)
- **API Server Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Auth Server Health**: [http://localhost:5000/health](http://localhost:5000/health)
- **phpMyAdmin**: [http://localhost:8080](http://localhost:8080)

## Usage

Use the web app for the full product experience, or call the API directly for scripting and integration.

> **Note:** The first analysis after startup can take longer while Ollama loads models. Later requests are usually faster. Guest and free-tier rate limits still apply.

### Web Interface


| Step | Action                                                                   |
| ---- | ------------------------------------------------------------------------ |
| 1    | Open [http://localhost:3000/analyzer](http://localhost:3000/analyzer)    |
| 2    | Upload a text-based PDF resume (scanned image-only PDFs work poorly)     |
| 3    | Optionally paste a target job description and/or career goal             |
| 4    | Submit and wait for the analysis dashboard (scores, gaps, coaching tips) |


Related pages once you are signed in:

- **Job recommender** — [http://localhost:3000/jrecommender](http://localhost:3000/jrecommender)
- **Plans & billing** — [http://localhost:3000/plans](http://localhost:3000/plans)

### API

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)


| Endpoint                           | Tier    | Auth                                            |
| ---------------------------------- | ------- | ----------------------------------------------- |
| `POST /api/resume/analyze`         | Free    | Optional (cookie); guests allowed within limits |
| `POST /api/resume/analyze/premium` | Premium | Required (signed-in premium user)               |


**Free-tier example** (PDF required; `jd_text` and `user_goal` optional):

```bash
curl -X POST "http://localhost:8000/api/resume/analyze" \
  -H "accept: application/json" \
  -F "resume_pdf=@/path/to/your/resume.pdf" \
  -F "jd_text=Software Engineer with Python and FastAPI experience" \
  -F "user_goal=Transition into a backend role"
```

A successful response is JSON with roughly this shape:

```json
{
  "intent": {},
  "analyzer": {},
  "ats": {},
  "feedback": {}
}
```


| Field      | Contents                                             |
| ---------- | ---------------------------------------------------- |
| `intent`   | Detected analysis intent / goal framing              |
| `analyzer` | Parsed sections, skills, experience signals, JD gaps |
| `ats`      | Resume quality and ATS fit scores                    |
| `feedback` | Coaching summary and actionable tips                 |


For premium analysis (optimizer, richer coaching, optional job finder), use `POST /api/resume/analyze/premium` while authenticated as a Premium user — see the Swagger UI for the full request schema.

## Configuration

Secrets and runtime settings live in `.env` files (never commit real values). Copy the examples first:

```sh
cp .env.example .env
cp api_server/.env.example api_server/.env
cp auth_server/.env.example auth_server/.env
```

For the Next.js client, create `client/.env.development.local` (or `.env.local`) with the public API base URLs below.

### Root (`.env`) — Docker Compose

Used by `compose.yaml` for volumes, LocalStack, Stripe CLI, and phpMyAdmin.


| Variable                                                                        | Purpose                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `MYSQL_DATA_DIR` / `MONGO_DATA_DIR` / `LOCALSTACK_DATA_DIR` / `OLLAMA_DATA_DIR` | Host paths for persistent volumes (optional; Compose has defaults) |
| `LOCALSTACK_AUTH_TOKEN`                                                         | **Required** for LocalStack Pro (S3 emulation)                     |
| `LOCAL_STACK_DEBUG` / `LOCAL_STACK_PERSISTENCE`                                 | LocalStack debug / persistence flags                               |
| `PHPMYADMIN_MYSQL_*`                                                            | phpMyAdmin → MySQL connection                                      |
| `STRIPE_SECRET_KEY`                                                             | Stripe CLI webhook forwarding to the auth server                   |
| `OLLAMA_API_BASE_URL`                                                           | Optional Ollama API base URL for tooling                           |


### API Server (`api_server/.env`)

Loaded by the FastAPI app and ARQ worker.


| Variable                                                     | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `API_KEY`                                                    | Shared service key (must align with auth server where required) |
| `JWT_SECRET_KEY`                                             | JWT verification — **must match** `auth_server`                 |
| `SQL_DB_URL`                                                 | SQLAlchemy URL for MySQL                                        |
| `RAPIDAPI_KEY`                                               | JSearch / job listings via RapidAPI                             |
| `OLLAMA_HOST` / `OLLAMA_MODEL` / `EMBEDDING_MODEL`           | Local LLM + embeddings (defaults: Qwen 2.5 7B, Nomic)           |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_ARQ_DB`                 | Cache, rate limits, ARQ queue                                   |
| `MONGODB_URI` / `MONGODB_NAME`                               | Resume / analysis document store                                |
| `LOCALSTACK_*` / `S3_BUCKET_NAME`                            | S3-compatible resume PDF storage                                |
| `PINECONE_API_KEY` / `PINECONE_HOST` / `PINECONE_INDEX_NAME` | Vector index (Pinecone Local in Compose)                        |


### Auth Server (`auth_server/.env`)

Loaded by Spring Boot (`SPRING_PROFILES_ACTIVE` selects `dev` / `proc` property sets).


| Variable                                                                                         | Purpose                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `SPRING_SERVER_PORT`                                                                             | HTTP port (Compose exposes `5000`)                       |
| `SPRING_PROFILES_ACTIVE`                                                                         | Active Spring profile                                    |
| `JWT_SECRET_KEY`                                                                                 | Access/refresh token signing — **must match** API server |
| `API_KEY` / `AUTH_API_KEY`                                                                       | Inter-service / filter keys                              |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                                      | Google OAuth 2.0                                         |
| `REACT_URL`                                                                                      | Frontend origin (CORS / redirects)                       |
| `FASTAPI_URL`                                                                                    | API server base URL for internal calls                   |
| `MYSQL_*`                                                                                        | Datasource host, port, database, credentials             |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`                                                   | Session / token support                                  |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET_KEY` | Billing & webhooks                                       |


### Client (`client/.env.development.local`)


| Variable                        | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SPRING_API_URL`    | Auth server base (e.g. `http://localhost:5000`)     |
| `NEXT_PUBLIC_FASTAPI_API_URL`   | API server base (e.g. `http://localhost:8000`)      |
| `NEXT_PUBLIC_CLIENT_IP_ADDRESS` | Optional client IP hint for guest geolocation flows |


### Tips

- Keep `JWT_SECRET_KEY` **identical** across `api_server` and `auth_server`.
- Prefer **test** Stripe keys locally; pair them with the Compose `stripe` CLI service for webhooks.
- LocalStack Pro needs a valid `LOCALSTACK_AUTH_TOKEN` or S3-backed resume flows will fail to start.
- After changing env files, recreate containers: `docker compose up -d --build`.

## Project Structure

```text
📦 jobgenius/
│
├── 🐳 compose.yaml
├── 🔒 .env.example
├── 📄 LICENSE
├── 🖼️ images/
│
├── 🐍 api_server/
│   ├── 🐳 Dockerfile
│   ├── 📋 pyproject.toml
│   ├── 📌 uv.lock
│   └── 📁 app/
│       ├── ⚡ main.py
│       ├── ⚙️ bg_worker.py
│       │
│       ├── 🤖 ai_agents/
│       │   ├── 🆓 free_tier_multiagents.py
│       │   ├── 👑 premium_multiagents.py
│       │   └── 🧠 agents/
│       │       ├── 🎯 agent1_intent.py
│       │       ├── 🔍 agent2_analyzer.py
│       │       ├── 📊 agent3_ats.py
│       │       ├── ✍️ agent4_optimizer.py
│       │       ├── 💬 agent6_finalizer.py
│       │       └── 💼 agent7_jobfinder.py
│       │
│       ├── 🛣️ routers/
│       ├── 🧩 services/
│       ├── 🗄️ db/
│       │   ├── 🔴 redis.py
│       │   ├── 🍃 mongo.py
│       │   ├── 🌲 pinecone.py
│       │   ├── ☁️ s3.py
│       │   ├── ⚙️ arq.py
│       │   ├── 🔌 mcp.py
│       │   └── 🔐 session.py
│       │
│       ├── 🔧 helpers/
│       ├── 📐 models/
│       ├── 📋 schemas/
│       ├── 🔑 auth/
│       └── 🧪 tests/
│
├── 🍃 auth_server/
│   ├── 🐳 Dockerfile
│   ├── 📦 pom.xml
│   ├── 🔒 .env.example
│   └── 📁 src/main/java/com/jobgenius/
│       ├── 🛡️ security/
│       ├── 🎮 controllers/
│       ├── 🧩 services/
│       ├── ⚙️ config/
│       └── 📁 models/
│
└── ▲ client/
    ├── 📦 package.json
    ├── ⚙️ next.config.ts
    ├── 🔷 tsconfig.json
    │
    ├── 📁 app/
    │   ├── 🏠 page.tsx
    │   ├── 🔬 analyzer/
    │   ├── 🎯 jrecommender/
    │   ├── 💳 plans/
    │   ├── 🔐 login/
    │   ├── 📝 register/
    │   ├── 💳 payment/
    │   ├── 👤 my_account/
    │   ├── ⚙️ settings_privacy/
    │   └── 💰 usage_billing/
    │
    ├── 🧩 components/
    ├── 🔑 auth/
    ├── 🔄 contexts/
    ├── 📡 services/
    └── 🛠️ utils/
```

**Note:** *This is a simplified view of the project structure. It may change at any time and does not include every file and directory.*

## Roadmap

JobGenius is under active development. Items below are planned next; checked items are done or in progress in the current public docs push.

### Upcoming — Frontend & product polish

- [x] **My Account** — profile overview; Premium resume upload history
- [x] **Usage & Billing** — usage meters, plan status, Stripe lifecycle visibility
- [x] **Settings & Privacy** — account preferences, change password, delete account
- [x] Clearer server error messages surfaced in the UI
- [ ] Premium job recommendations — loading notice while semantic matching runs (seconds to minutes)
- [x] Project `README.md` (setup, usage, stack documentation)

**Note:** *This roadmap is subject to change anytime. Please visit the [roadmap tracker](https://github.com/tnp0911/jobgenius/issues/1) for the most up-to-date information.*

See the [open issues](https://github.com/tnp0911/jobgenius/issues) for discussion, or [open a new issue](https://github.com/tnp0911/jobgenius/issues/new) to suggest a feature.

## License

Distributed under the GNU Affero General Public License v3.0 License. See [LICENSE](https://github.com/tnp0911/jobgenius/blob/main/LICENSE) for more information.

## Acknowledgements

Built with and inspired by excellent open-source projects and platforms:

- [Next.js](https://nextjs.org/) / [React](https://react.dev/) — frontend
- [FastAPI](https://fastapi.tiangolo.com/) / [Uvicorn](https://www.uvicorn.org/) / [Pydantic](https://docs.pydantic.dev/) — API server
- [ARQ](https://arq-docs.helpmanual.io/) — Redis-backed background jobs
- [Spring Boot](https://spring.io/projects/spring-boot) / [Spring Security](https://spring.io/projects/spring-security) — auth & billing APIs
- [LangChain](https://www.langchain.com/) / [LangGraph](https://langchain-ai.github.io/langgraph/) — multi-agent orchestration
- [FastMCP](https://gofastmcp.com/) — MCP tool layer for job search
- [Ollama](https://ollama.com/) — local LLM & embedding runtime
- [Redis](https://redis.io/) / [MongoDB](https://www.mongodb.com/) / [MySQL](https://www.mysql.com/) — data & cache
- [Pinecone](https://www.pinecone.io/) — vector search (local + cloud patterns)
- [LocalStack](https://localstack.cloud/) — local AWS S3 emulation
- [Docker](https://www.docker.com/) / Compose — local multi-service orchestration
- [Stripe](https://stripe.com/) — subscriptions & webhooks
- [RapidAPI JSearch](https://rapidapi.com/) — job listing data
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) — README structure inspiration
- [Img Shields](https://shields.io)

Thanks to everyone who builds and maintains these tools.

⭐️ If this project helped you, consider giving it a star ⭐️