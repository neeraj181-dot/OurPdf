from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.api_route("/metrics", methods=["GET", "POST"])
@router.api_route("/metrics/", methods=["GET", "POST"])
def metrics():
    return {"status": "ok"}

