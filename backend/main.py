import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from controllers.cookbook_controller import router as cookbook_router
from controllers.recipe_controller import router as recipe_router
from db.database import Base, engine
from logging_config import configure_logging
from models import cookbook, recipe  # noqa: F401

configure_logging()

logger = logging.getLogger(__name__)

app = FastAPI(title="Cookbook API", version="1.0.0")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
	logger.info("Starting up — creating database tables if needed")
	Base.metadata.create_all(bind=engine)
	logger.info("Database tables ready")


@app.get("/health")
def health() -> dict[str, str]:
	logger.debug("Health check called")
	return {"status": "ok"}


app.include_router(cookbook_router)
app.include_router(recipe_router)
