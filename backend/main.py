from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from controllers.cookbook_controller import router as cookbook_router
from controllers.recipe_controller import router as recipe_router
from db.database import Base, engine
from models import cookbook, recipe  # noqa: F401

app = FastAPI(title="Cookbook API", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
	Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


app.include_router(cookbook_router)
app.include_router(recipe_router)
