# Python AI Service (`apps/ai-service`)

FastAPI service for Form Schema Engine, Dynamic System Prompt Generation, and Field Data Validation.

## Endpoints
- `GET /health`: Health check endpoint.
- `GET /api/schema/{theme_id}`: Fetch schema, initial prompt, and AssemblyAI tool definitions.
- `POST /api/validate-field`: Validate extracted form value.
- `POST /api/generate-prompt`: Generate progress-aware system prompt update based on filled fields.

## Commands
```bash
# Activate venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8001
```
