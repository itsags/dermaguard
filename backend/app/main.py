from typing import Literal
from uuid import UUID
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import httpx
import re
from .config import settings
from .security import current_user_id
from .image_validation import validate_image_metadata

app = FastAPI(title="DermaGuard API", version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


class UploadRequest(BaseModel):
    case_id: UUID
    filename: str
    content_type: str

    @field_validator("filename")
    @classmethod
    def safe_filename(cls, value: str) -> str:
        if not re.fullmatch(r'[A-Za-z0-9._-]{1,120}', value) or '..' in value:
            raise ValueError("Invalid filename")
        return value

    @field_validator("content_type")
    @classmethod
    def image_only(cls, value: str) -> str:
        if value not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("Only JPEG, PNG, or WebP images are allowed")
        return value


class ImageQualityRequest(BaseModel):
    content_type: str
    size_bytes: int
    width: int | None = None
    height: int | None = None


class AssessmentCreate(BaseModel):
    case_id: UUID
    photo_path: str
    client_request_id: str | None = None


class AssessmentQualityRequest(ImageQualityRequest):
    acceptable: bool = True


async def _supabase_request(
    method: str,
    table: str,
    user_id: str,
    *,
    query: str = "",
    payload: dict | None = None,
):
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503, detail="Assessment persistence is not configured"
        )
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    url = f"{settings.supabase_url}/rest/v1/{table}{query}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.request(method, url, headers=headers, json=payload)
    if response.is_error:
        raise HTTPException(status_code=502, detail="Database request failed")
    return response.json() if response.content else []


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/uploads/sign")
async def sign_upload(payload: UploadRequest, user_id: str = Depends(current_user_id)):
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Storage signing is not configured")
    from .connected import owned_case
    await owned_case(payload.case_id, user_id)
    object_path = f"{user_id}/{payload.case_id}/{payload.filename}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
    }
    url = f"{settings.supabase_url}/storage/v1/object/upload/sign/dermaguard-photos/{object_path}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, headers=headers)
    if response.is_error:
        raise HTTPException(status_code=502, detail="Could not create upload URL")
    return {
        "path": object_path,
        "signed_url": response.json().get("url"),
        "expires_in_seconds": 120,
    }


@app.post("/api/v1/uploads/validate")
async def validate_upload(
    payload: ImageQualityRequest, user_id: str = Depends(current_user_id)
):
    result = validate_image_metadata(
        payload.content_type,
        payload.size_bytes,
        payload.width,
        payload.height,
        settings.max_upload_bytes,
    )
    return {
        "valid": result.valid,
        "code": result.code,
        "message": result.message,
        "scope_check": "unavailable",
    }


@app.post("/api/v1/assessments", status_code=201)
async def create_assessment(
    payload: AssessmentCreate, user_id: str = Depends(current_user_id)
):
    from .connected import owned_case, validate_stored_image
    await owned_case(payload.case_id, user_id)
    await validate_stored_image(payload.photo_path, user_id, payload.case_id)
    row = {
        "user_id": user_id,
        "case_id": str(payload.case_id),
        "photo_path": payload.photo_path,
        "status": "uploaded",
        "quality_status": "pending",
        "model_status": settings.model_mode,
        "model_version": settings.model_version or None,
        "client_request_id": payload.client_request_id,
    }
    rows = await _supabase_request("POST", "assessments", user_id, payload=row)
    return rows[0] if rows else row


@app.get("/api/v1/assessments")
async def list_assessments(user_id: str = Depends(current_user_id)):
    rows = await _supabase_request(
        "GET",
        "assessments",
        user_id,
        query=f"?user_id=eq.{user_id}&order=created_at.desc",
    )
    return {"items": rows}


@app.get("/api/v1/assessments/{assessment_id}")
async def get_assessment(assessment_id: UUID, user_id: str = Depends(current_user_id)):
    rows = await _supabase_request(
        "GET",
        "assessments",
        user_id,
        query=f"?id=eq.{assessment_id}&user_id=eq.{user_id}&limit=1",
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return rows[0]


@app.post("/api/v1/assessments/{assessment_id}/quality-check")
async def quality_check(
    assessment_id: UUID,
    payload: AssessmentQualityRequest,
    user_id: str = Depends(current_user_id),
):
    result = validate_image_metadata(
        payload.content_type,
        payload.size_bytes,
        payload.width,
        payload.height,
        settings.max_upload_bytes,
    )
    valid = result.valid and payload.acceptable
    update = {
        "quality_status": "passed" if valid else "rejected",
        "status": "failed" if not valid else "queued",
        "error_code": None if valid else result.code,
        "model_status": settings.model_mode,
    }
    rows = await _supabase_request(
        "PATCH",
        "assessments",
        user_id,
        query=f"?id=eq.{assessment_id}&user_id=eq.{user_id}",
        payload=update,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {
        **rows[0],
        "quality_message": result.message,
        "inference": (
            "unavailable"
            if valid and settings.model_mode == "unavailable"
            else settings.model_mode
        ),
    }

# Connected application routes
from .connected import router as connected_router
app.include_router(connected_router)
from .clinics import router as clinic_router
app.include_router(clinic_router)
