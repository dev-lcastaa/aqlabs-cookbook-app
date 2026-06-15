from fastapi import APIRouter, Depends, File, HTTPException, Query, status, UploadFile
from sqlalchemy.orm import Session

from db.database import get_db
from models.schemas import AIRecommendationRead, AIRecommendationRequest, RecipeCreate, RecipeRead, RecipeRipperParseRead, RecipeUpdate, SocialRecipeRipperRequest
from service import recipe_recommender_service, recipe_ripper_service, recipe_service, social_recipe_ripper_service

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


@router.post("", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db)):
    recipe = recipe_service.create_recipe(db, payload)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cookbook not found")
    return recipe


@router.post("/parse-from-images", response_model=RecipeRipperParseRead)
def parse_recipe_from_images(files: list[UploadFile] = File(...)):
    try:
        return recipe_ripper_service.parse_recipe_from_images(files)
    except recipe_ripper_service.RecipeRipperError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/parse-from-social", response_model=RecipeRipperParseRead)
def parse_recipe_from_social(payload: SocialRecipeRipperRequest):
    try:
        return social_recipe_ripper_service.parse_recipe_from_social_post(payload)
    except social_recipe_ripper_service.SocialRecipeRipperError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/recommend", response_model=AIRecommendationRead)
def recommend_recipe(payload: AIRecommendationRequest):
    try:
        return recipe_recommender_service.recommend_recipe(payload)
    except recipe_recommender_service.AIRecommenderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("", response_model=list[RecipeRead])
def list_recipes(cookbook_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    return recipe_service.list_recipes(db, cookbook_id)


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = recipe_service.get_recipe_by_id(db, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeRead)
def update_recipe(recipe_id: int, payload: RecipeUpdate, db: Session = Depends(get_db)):
    recipe = recipe_service.get_recipe_by_id(db, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe_service.update_recipe(db, recipe, payload)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = recipe_service.get_recipe_by_id(db, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    recipe_service.delete_recipe(db, recipe)
