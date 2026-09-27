# KavQen — Voice Agent Form Filler Monorepo

General-purpose voice agent that converts natural audio conversations into structured form fields in real-time. Built on top of **AssemblyAI Voice Agent API**.

## Monorepo Architecture

- **`apps/client`**: Next.js 14+ (App Router) Frontend for live split-screen voice & form filler UI.
- **`apps/gateway`**: Node.js + Express + Socket.IO + AssemblyAI WebSocket Bridge Server.
- **`apps/ai-service`**: Python 3.12 + FastAPI AI & Business logic engine (Prompt builder, JSON Schema engine, Field validator).
- **`configs/`**: Shared JSON form configurations (e.g. `clinic.json`, `complaint.json`).

## Setup & Running

### Prerequisites
- Node.js >= 18.0.0
- Python >= 3.11
- pnpm / npm

### Setup

1. **Install JS/TS dependencies:**
   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Setup Python AI Service:**
   ```bash
   cd apps/ai-service
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

### Running Services

- **Run Client Frontend:** `pnpm --filter client dev` (http://localhost:3002)
- **Run Gateway Server:** `pnpm --filter gateway dev` (http://localhost:3003)
- **Run AI Service:** `cd apps/ai-service && uvicorn main:app --reload --port 8001` (http://localhost:8001)

## Local demo: owner shares a form

Run database migrations and the repeatable demo seed:

```bash
pnpm --filter gateway exec prisma migrate deploy
pnpm --filter gateway exec tsx prisma/seed.ts
```

- Owner: `superadmin@kavqen.com` / `superadmin123`
- Participant: `demo.user@kavqen.com` / `demo12345`
- Demo access code: `KQ-DEMO-2026` (valid for 24 hours after the last seed run)

Owner opens **Workflows** and clicks **Bagikan form** on **Clinic Intake Demo** to create a code with a chosen expiry. The full code and share link appear once. Participant logs in, enters the code on Dashboard, opens the form, and submits it. Owner sees results in **Submissions**. Expired or revoked codes cannot open or submit the form.

Owner can add Knowledge Base documents; republish a workflow to include current documents in its voice prompt. Workflow draft generation uses AssemblyAI LLM Gateway and requires `ASSEMBLYAI_API_KEY`. Dashboard and Analytics show stored workflow and submission counts. Notifications record new submissions and workflow publications. Integrations shows local service status and configuration availability.

## Running with Docker

The root `Dockerfile` contains production targets for the client, gateway, and AI service. Docker Compose builds and starts all three services.

1. Configure the AssemblyAI key:
   ```bash
   cp apps/gateway/.env.example apps/gateway/.env
   # Edit apps/gateway/.env and set ASSEMBLYAI_API_KEY.
   ```

2. Configure the browser-facing gateway URL:
   ```bash
   cp .env.docker.example .env
   ```
   For a remote server, change `NEXT_PUBLIC_GATEWAY_URL` to the public gateway URL or server address before building the image.

3. Build and start everything:
   ```bash
   docker compose up -d --build
   ```

4. Check container status and logs:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

The client and gateway are exposed on ports `3000` and `3001`. The AI service stays private inside the Docker network on port `8000`. Stop the stack with `docker compose down`. Workflow JSON files are bind-mounted from `./configs`, so edits made by the application persist on the host.
