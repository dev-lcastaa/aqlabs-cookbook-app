import base64
import json
import logging
import os
from typing import Any

from fastapi import UploadFile, status
from openai import OpenAI

from models.schemas import RecipeRipperParseRead

logger = logging.getLogger(__name__)

MODEL_NAME = "gpt-4.1"
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_FILES = 5
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


class RecipeRipperError(Exception):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def parse_recipe_from_images(files: list[UploadFile]) -> RecipeRipperParseRead:
    logger.info("parse_recipe_from_images file_count=%d", len(files))
    if not files:
        raise RecipeRipperError("At least one image is required")
    if len(files) > MAX_FILES:
        raise RecipeRipperError(f"Upload up to {MAX_FILES} images at a time")

    image_contents: list[dict[str, str]] = []
    for uploaded_file in files:
        mime_type = (uploaded_file.content_type or "").lower()
        if mime_type not in ALLOWED_MIME_TYPES:
            raise RecipeRipperError("Unsupported image type. Use JPG, PNG, WEBP, or HEIC.")

        image_bytes = uploaded_file.file.read()
        if not image_bytes:
            raise RecipeRipperError("One or more uploaded files are empty")
        if len(image_bytes) > MAX_FILE_BYTES:
            raise RecipeRipperError(
                f"Each image must be {MAX_FILE_BYTES // (1024 * 1024)}MB or smaller",
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        encoded = base64.b64encode(image_bytes).decode("ascii")
        image_contents.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{encoded}",
                },
            }
        )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RecipeRipperError(
            "OPENAI_API_KEY is not configured on the server",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    system_prompt = (
        "You extract recipe data from images. "
        "Return strict JSON with keys: recipe_name, ethnicity, ingredients, directions. "
        "ingredients must be an array of short ingredient strings. "
        "directions must be a single text block with ordered steps."
    )

    user_instruction = (
        "Parse the recipe from these images. "
        "If some fields are unclear, infer conservatively and keep text concise. "
        "If ethnicity is unknown, set it to null."
    )

    logger.info("parse_recipe_from_images calling OpenAI model=%s images=%d", MODEL_NAME, len(image_contents))
    try:
        client = OpenAI(api_key=api_key, timeout=45.0, max_retries=1)
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_instruction}, *image_contents],
                },
            ],
        )
    except Exception as exc:
        logger.error("parse_recipe_from_images OpenAI call failed: %s", exc)
        raise RecipeRipperError(
            f"Failed to parse recipe with OpenAI: {exc}",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise RecipeRipperError("OpenAI returned an empty response", status.HTTP_502_BAD_GATEWAY)

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RecipeRipperError("OpenAI returned malformed JSON", status.HTTP_502_BAD_GATEWAY) from exc

    normalized = _normalize_recipe_payload(parsed)
    return RecipeRipperParseRead(**normalized)


def _normalize_recipe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    recipe_name = str(payload.get("recipe_name", "")).strip()
    directions = str(payload.get("directions", "")).strip()

    if not recipe_name:
        raise RecipeRipperError("Could not determine recipe name from image")
    if not directions:
        raise RecipeRipperError("Could not determine recipe directions from image")

    raw_ingredients = payload.get("ingredients", [])
    ingredients: list[str] = []

    if isinstance(raw_ingredients, list):
        ingredients = [str(item).strip() for item in raw_ingredients if str(item).strip()]
    elif isinstance(raw_ingredients, str):
        ingredients = [line.strip() for line in raw_ingredients.splitlines() if line.strip()]

    ethnicity_value = payload.get("ethnicity")
    ethnicity = str(ethnicity_value).strip() if ethnicity_value is not None else None
    if ethnicity == "":
        ethnicity = None

    return {
        "recipe_name": recipe_name,
        "ethnicity": ethnicity,
        "ingredients": ingredients,
        "directions": directions,
    }
