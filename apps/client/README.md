# Next.js Client App (`apps/client`)

Frontend application for KavQen Voice Agent Form Filler.

## Features
- Split screen UI layout (Left: Mic controls & Audio visualizer/transcript, Right: Live form panel).
- Connects to `apps/gateway` via Socket.IO for real-time form updates & audio streaming.

## Commands
```bash
# Start dev server
pnpm dev
# or from root
pnpm --filter client dev
```
