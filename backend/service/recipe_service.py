from sqlalchemy.orm import Session

from models.cookbook import Cookbook
from models.recipe import Recipe
from models.schemas import RecipeCreate, RecipeUpdate


def create_recipe(db: Session, payload: RecipeCreate) -> Recipe | None:
    cookbook = db.query(Cookbook).filter(Cookbook.id == payload.cookbook_id).first()
    if cookbook is None:
        return None

    ethnicity = payload.ethnicity if payload.ethnicity else cookbook.ethnicity
    recipe = Recipe(
        cookbook_id=payload.cookbook_id,
        recipe_name=payload.recipe_name,
        ethnicity=ethnicity,
        ingredients=payload.ingredients,
        directions=payload.directions,
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


def list_recipes(db: Session, cookbook_id: int | None = None) -> list[Recipe]:
    query = db.query(Recipe)
    if cookbook_id is not None:
        query = query.filter(Recipe.cookbook_id == cookbook_id)
    return query.order_by(Recipe.id.desc()).all()


def get_recipe_by_id(db: Session, recipe_id: int) -> Recipe | None:
    return db.query(Recipe).filter(Recipe.id == recipe_id).first()


def update_recipe(db: Session, recipe: Recipe, payload: RecipeUpdate) -> Recipe:
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(recipe, key, value)
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


def delete_recipe(db: Session, recipe: Recipe) -> None:
    db.delete(recipe)
    db.commit()
