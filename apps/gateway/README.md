# Node.js Gateway Server (`apps/gateway`)

Orchestration & WebSocket bridge server for KavQen.

## Responsibilities
- Serves Socket.IO server for `apps/client`.
- Manages secure WSS connection to AssemblyAI Voice Agent API.
- Calls `apps/ai-service` HTTP endpoints for dynamic prompts and field extraction validation.

## Commands
```bash
# Run dev mode
pnpm dev
```
