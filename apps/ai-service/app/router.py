from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from app.schema_engine import SchemaEngine
from app.validator import FieldValidator

router = APIRouter(prefix="/api")

class ValidateFieldRequest(BaseModel):
    theme_id: str
    field_name: str
    value: str

class GeneratePromptRequest(BaseModel):
    theme_id: str
    filled_fields: Dict[str, Any]

@router.get("/workflows")
def list_workflows():
    return {"success": True, "message": "Workflows retrieved", "data": {"workflows": SchemaEngine.list_schemas()}}

@router.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str):
    schema = SchemaEngine.load_schema(workflow_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
    return {"success": True, "message": "Schema retrieved", "data": schema}

@router.post("/workflows/{workflow_id}")
def save_workflow(workflow_id: str, data: Dict[str, Any] = Body(...)):
    success = SchemaEngine.save_schema(workflow_id, data)
    return {"success": True, "message": "Workflow saved", "data": {"success": success, "workflow_id": workflow_id}}

@router.get("/schema/{theme_id}")
def get_schema(theme_id: str, lang: str = "en"):
    schema = SchemaEngine.load_schema(theme_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema theme '{theme_id}' not found")
    
    prompt = SchemaEngine.generate_system_prompt(schema, lang=lang)
    tools = SchemaEngine.generate_assemblyai_tools(schema)
    greeting = SchemaEngine.get_greeting(schema, lang=lang)
    
    return {
        "success": True,
        "message": "Schema generated",
        "data": {
            "schema": schema,
            "greeting": greeting,
            "fields": schema.get("fields", []),
            "nodes": schema.get("nodes", []),
            "edges": schema.get("edges", []),
            "system_prompt": prompt,
            "tools": tools,
            "language": lang
        }
    }

@router.post("/validate-field")
def validate_field(req: ValidateFieldRequest):
    schema = SchemaEngine.load_schema(req.theme_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema '{req.theme_id}' not found")
    
    field_def = next((f for f in schema.get("fields", []) if f["name"] == req.field_name), None)
    if not field_def:
        raise HTTPException(status_code=400, detail=f"Field '{req.field_name}' not defined in schema")
    
    is_valid, cleaned_val_or_error = FieldValidator.validate_field(
        field_type=field_def["type"],
        value=req.value,
        options=field_def.get("options")
    )
    
    return {
        "success": True,
        "message": "Field validated",
        "data": {
            "valid": is_valid,
            "field_name": req.field_name,
            "value": cleaned_val_or_error if is_valid else req.value,
            "error": None if is_valid else cleaned_val_or_error
        }
    }

@router.post("/generate-prompt")
def generate_prompt(req: GeneratePromptRequest):
    schema = SchemaEngine.load_schema(req.theme_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema '{req.theme_id}' not found")
    
    prompt = SchemaEngine.generate_system_prompt(schema, req.filled_fields)
    return {"success": True, "message": "Prompt generated", "data": {"system_prompt": prompt}}

class ExtractRequest(BaseModel):
    text: str
    theme_id: str = "clinic"

@router.post("/extract")
def extract_entities(req: ExtractRequest):
    from app.extractor import IndonesianEntityExtractor
    extracted = IndonesianEntityExtractor.extract_fields(req.text, req.theme_id)
    return {"success": True, "message": "Entities extracted", "data": {"extracted": extracted}}
