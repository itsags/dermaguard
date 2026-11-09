import httpx
from fastapi import Header, HTTPException
from .config import settings


async def current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Server is not configured")
    try:
        headers = {"apikey": settings.supabase_anon_key, "Authorization": authorization}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user", headers=headers
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail="Could not validate access token"
        ) from exc
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid access token")
    user_id = response.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return user_id
