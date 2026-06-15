from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RecipeBase(BaseModel):
    recipe_name: str = Field(..., min_length=1, max_length=200)
    ethnicity: str | None = Field(default=None, min_length=1, max_length=120)
    ingredients: list[str] = Field(default_factory=list)
    directions: str = Field(..., min_length=1)


class RecipeCreate(RecipeBase):
    cookbook_id: int


class RecipeUpdate(BaseModel):
    recipe_name: str | None = Field(default=None, min_length=1, max_length=200)
    ethnicity: str | None = Field(default=None, min_length=1, max_length=120)
    ingredients: list[str] | None = None
    directions: str | None = Field(default=None, min_length=1)


class RecipeRead(RecipeBase):
    id: int
    cookbook_id: int

    model_config = ConfigDict(from_attributes=True)


class RecipeRipperParseRead(BaseModel):
    recipe_name: str = Field(..., min_length=1, max_length=200)
    ethnicity: str | None = Field(default=None, min_length=1, max_length=120)
    ingredients: list[str] = Field(default_factory=list)
    directions: str = Field(..., min_length=1)


class AIRecommendationRequest(BaseModel):
    ethnicity: str = Field(..., min_length=1, max_length=120)
    ingredients: list[str] = Field(..., min_length=1, max_length=50)
    reroll_token: int = Field(default=0, ge=0)


class AIRecommendationRead(BaseModel):
    recipe_name: str = Field(..., min_length=1, max_length=200)
    ethnicity: str = Field(..., min_length=1, max_length=120)
    ingredients: list[str] = Field(default_factory=list)
    directions: str = Field(..., min_length=1)
    reroll_token: int = Field(..., ge=0)


class CookbookBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    ethnicity: str = Field(..., min_length=1, max_length=120)


class CookbookCreate(CookbookBase):
    pass


class CookbookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    ethnicity: str | None = Field(default=None, min_length=1, max_length=120)


class CookbookRead(CookbookBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CookbookDetail(CookbookRead):
    recipes: list[RecipeRead] = Field(default_factory=list)
