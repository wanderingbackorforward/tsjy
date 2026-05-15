from fastapi import APIRouter
from app.repositories.system_repository import status

router = APIRouter(prefix="/system", tags=["v2-system"])


@router.get("/status")
def system_status():
    return status()
