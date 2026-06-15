import json
import logging
import os
from typing import Any

from fastapi import status
from openai import OpenAI

from models.schemas import AIRecommendationRead, AIRecommendationRequest

logger = logging.getLogger(__name__)

MODEL_NAME = "gpt-4.1"
MAX_ATTEMPTS = 3


class AIRecommenderError(Exception):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def recommend_recipe(payload: AIRecommendationRequest) -> AIRecommendationRead:
    logger.info("recommend_recipe ethnicity=%r ingredients=%d reroll=%d", payload.ethnicity, len(payload.ingredients), payload.reroll_token)
    ingredients = _normalize_input_ingredients(payload.ingredients)
    if not ingredients:
        logger.warning("recommend_recipe — empty ingredient list after normalisation")
        raise AIRecommenderError("Provide at least one valid ingredient")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIRecommenderError(
            "OPENAI_API_KEY is not configured on the server",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    ingredient_map = {item.lower(): item for item in ingredients}

    base_system_prompt = (
        "You are a professional chef assistant. "
        "Generate exactly one recipe using only ingredients supplied by the user. "
        "Do not introduce substitutions, pantry additions, or optional extras. "
        "Return strict JSON with keys: recipe_name, ingredients, directions. "
        "ingredients must be an array of ingredient strings and each entry must match one provided ingredient. "
        "directions must be plain text with numbered steps."
    )

    client = OpenAI(api_key=api_key, timeout=45.0, max_retries=1)
    last_error = "Unable to create a strict ingredient-only recommendation"

    for attempt in range(MAX_ATTEMPTS):
        reroll_offset = payload.reroll_token + attempt
        logger.info("recommend_recipe attempt=%d/%d reroll_offset=%d", attempt + 1, MAX_ATTEMPTS, reroll_offset)
        parsed = _query_recommendation(
            client=client,
            system_prompt=base_system_prompt,
            ethnicity=payload.ethnicity,
            ingredients=ingredients,
            reroll_token=reroll_offset,
        )

        validated = _validate_model_recipe(parsed, ingredient_map)
        if validated is not None:
            logger.info("recommend_recipe ok attempt=%d name=%r", attempt + 1, validated.get("recipe_name"))
            return AIRecommendationRead(
                recipe_name=validated["recipe_name"],
                ethnicity=payload.ethnicity,
                ingredients=validated["ingredients"],
                directions=validated["directions"],
                reroll_token=payload.reroll_token + 1,
            )

        logger.warning("recommend_recipe attempt=%d failed ingredient validation", attempt + 1)
        last_error = "Model returned ingredients outside your list; retrying failed"

    logger.error("recommend_recipe exhausted %d attempts", MAX_ATTEMPTS)
    raise AIRecommenderError(last_error, status.HTTP_422_UNPROCESSABLE_ENTITY)


def _query_recommendation(
    client: OpenAI,
    system_prompt: str,
    ethnicity: str,
    ingredients: list[str],
    reroll_token: int,
) -> dict[str, Any]:
    ingredient_lines = "\n".join(f"- {item}" for item in ingredients)
    user_prompt = (
        f"Ethnicity: {ethnicity}\n"
        f"Reroll token: {reroll_token}\n"
        "Allowed ingredients (use only these):\n"
        f"{ingredient_lines}\n\n"
        "Create one complete recipe and vary output based on reroll token while staying within allowed ingredients."
    )

    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as exc:
        raise AIRecommenderError(
            f"Failed to get recommendation from OpenAI: {exc}",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise AIRecommenderError("OpenAI returned an empty recommendation", status.HTTP_502_BAD_GATEWAY)

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise AIRecommenderError("OpenAI returned malformed JSON", status.HTTP_502_BAD_GATEWAY) from exc


def _normalize_input_ingredients(ingredients: list[str]) -> list[str]:
    normalized = [item.strip() for item in ingredients if item and item.strip()]
    seen: set[str] = set()
    unique: list[str] = []
    for item in normalized:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _validate_model_recipe(payload: dict[str, Any], ingredient_map: dict[str, str]) -> dict[str, Any] | None:
    recipe_name = str(payload.get("recipe_name", "")).strip()
    directions = str(payload.get("directions", "")).strip()
    if not recipe_name or not directions:
        return None

    raw_ingredients = payload.get("ingredients", [])
    if not isinstance(raw_ingredients, list) or not raw_ingredients:
        return None

    validated: list[str] = []
    seen: set[str] = set()
    for raw_item in raw_ingredients:
        item = str(raw_item).strip()
        key = item.lower()
        if key not in ingredient_map:
            return None
        canonical = ingredient_map[key]
        canonical_key = canonical.lower()
        if canonical_key in seen:
            continue
        seen.add(canonical_key)
        validated.append(canonical)

    if not validated:
        return None

    return {
        "recipe_name": recipe_name,
        "ingredients": validated,
        "directions": directions,
    }
