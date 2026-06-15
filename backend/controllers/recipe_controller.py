import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, status, UploadFile
from sqlalchemy.orm import Session

from db.database import get_db
from models.schemas import AIRecommendationRead, AIRecommendationRequest, RecipeCreate, RecipeRead, RecipeRipperParseRead, RecipeUpdate, SocialRecipeRipperRequest
from service import recipe_recommender_service, recipe_ripper_service, recipe_service, social_recipe_ripper_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


@router.post("", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db)):
    logger.info("create_recipe cookbook_id=%d name=%r", payload.cookbook_id, payload.recipe_name)
    recipe = recipe_service.create_recipe(db, payload)
    if recipe is None:
        logger.warning("create_recipe failed — cookbook %d not found", payload.cookbook_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cookbook not found")
    logger.info("create_recipe ok recipe_id=%d", recipe.id)
    return recipe


@router.post("/parse-from-images", response_model=RecipeRipperParseRead)
def parse_recipe_from_images(files: list[UploadFile] = File(...)):
    logger.info("parse_recipe_from_images file_count=%d", len(files))
    try:
        result = recipe_ripper_service.parse_recipe_from_images(files)
        logger.info("parse_recipe_from_images ok name=%r", result.recipe_name)
        return result
    except recipe_ripper_service.RecipeRipperError as exc:
        logger.warning("parse_recipe_from_images error status=%d detail=%r", exc.status_code, exc.detail)
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/parse-from-social", response_model=RecipeRipperParseRead)
def parse_recipe_from_social(payload: SocialRecipeRipperRequest):
    logger.info("parse_recipe_from_social url=%r", payload.url)
    try:
        result = social_recipe_ripper_service.parse_recipe_from_social_post(payload)
        logger.info("parse_recipe_from_social ok name=%r", result.recipe_name)
        return result
    except social_recipe_ripper_service.SocialRecipeRipperError as exc:
        logger.warning("parse_recipe_from_social error status=%d detail=%r", exc.status_code, exc.detail)
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/recommend", response_model=AIRecommendationRead)
def recommend_recipe(payload: AIRecommendationRequest):
    logger.info("recommend_recipe ethnicity=%r ingredient_count=%d reroll=%d", payload.ethnicity, len(payload.ingredients), payload.reroll_token)
    try:
        result = recipe_recommender_service.recommend_recipe(payload)
        logger.info("recommend_recipe ok name=%r", result.recipe_name)
        return result
    except recipe_recommender_service.AIRecommenderError as exc:
        logger.warning("recommend_recipe error status=%d detail=%r", exc.status_code, exc.detail)
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
        logger.warning("delete_recipe — recipe %d not found", recipe_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    logger.info("delete_recipe recipe_id=%d", recipe_id)
    recipe_service.delete_recipe(db, recipe)
