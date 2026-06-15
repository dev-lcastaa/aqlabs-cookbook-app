import html
import json
import os
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import status
from openai import OpenAI

from models.schemas import RecipeRipperParseRead, SocialRecipeRipperRequest

MODEL_NAME = "gpt-4.1"
MAX_SOURCE_CHARS = 25000
MAX_FETCH_CHARS = 12000
FETCH_TIMEOUT_SECONDS = 12
MAX_METADATA_VALUES = 24


class SocialRecipeRipperError(Exception):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def parse_recipe_from_social_post(payload: SocialRecipeRipperRequest) -> RecipeRipperParseRead:
    source_text = _build_source_text(payload.text, payload.url)
    if not source_text:
        raise SocialRecipeRipperError("Provide a public URL that contains readable recipe content.")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SocialRecipeRipperError(
            "OPENAI_API_KEY is not configured on the server",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    system_prompt = (
        "You extract recipe data from social media posts and linked pages. "
        "Return strict JSON with keys: recipe_name, ethnicity, ingredients, directions. "
        "ingredients must be an array of short ingredient strings. "
        "directions must be a single text block with ordered steps. "
        "If the source is from Instagram, Facebook, or YouTube, prioritize the caption, title, description, and visible public metadata. "
        "Ignore hashtags, emojis, promotional text, and unrelated caption noise."
    )

    user_instruction = (
        "Parse the recipe from this social post and any fetched URL text. "
        "Use the URL content when available, especially page title, description, og metadata, twitter metadata, JSON-LD, and visible public text. "
        "Do not invent missing details. "
        "If ethnicity is unknown, set it to null. "
        "If the source text is noisy, focus only on the actual recipe content.\n\n"
        f"SOURCE TEXT:\n{source_text}"
    )

    try:
        client = OpenAI(api_key=api_key, timeout=45.0, max_retries=1)
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_instruction},
            ],
        )
    except Exception as exc:
        raise SocialRecipeRipperError(
            f"Failed to parse recipe with OpenAI: {exc}",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise SocialRecipeRipperError("OpenAI returned an empty response", status.HTTP_502_BAD_GATEWAY)

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise SocialRecipeRipperError("OpenAI returned malformed JSON", status.HTTP_502_BAD_GATEWAY) from exc

    normalized = _normalize_recipe_payload(parsed)
    return RecipeRipperParseRead(**normalized)


def _build_source_text(post_text: str, url: str | None) -> str:
    parts: list[str] = []

    cleaned_text = _clean_text(post_text)
    if cleaned_text:
        parts.append(f"Post text:\n{cleaned_text}")

    if url:
        fetched_source = _fetch_url_source(url)
        if fetched_source:
            parts.append(f"Fetched URL source:\n{fetched_source}")

    return "\n\n".join(parts)[:MAX_SOURCE_CHARS]


def _fetch_url_source(url: str) -> str:
    normalized_url = url.strip()
    if not normalized_url:
        return ""

    parsed_url = urlparse(normalized_url)
    if not parsed_url.scheme:
        normalized_url = f"https://{normalized_url}"

    platform_hint = _infer_platform_hint(normalized_url)

    request = Request(normalized_url, headers={"User-Agent": "Mozilla/5.0"})
    response = None
    try:
        response = urlopen(request, timeout=FETCH_TIMEOUT_SECONDS)
        content_type = response.headers.get_content_type().lower()
        if content_type and content_type != "text/html" and not content_type.startswith("text/"):
            return ""

        raw_bytes = response.read(MAX_FETCH_CHARS + 1)
        if not raw_bytes:
            return ""

        charset = response.headers.get_content_charset() or "utf-8"
        try:
            html_text = raw_bytes.decode(charset, errors="ignore")
        except LookupError:
            html_text = raw_bytes.decode("utf-8", errors="ignore")

        metadata = _extract_page_metadata(html_text)
        visible_text = _strip_html(html_text)

        source_parts: list[str] = []
        if platform_hint:
            source_parts.append(f"Platform: {platform_hint}")

        if metadata:
            source_parts.append("Page metadata:")
            source_parts.extend(metadata)

        if visible_text:
            source_parts.append(f"Visible page text:\n{visible_text}")

        return "\n".join(source_parts)[:MAX_FETCH_CHARS]
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return ""
    finally:
        if response is not None:
            response.close()


def _infer_platform_hint(url: str) -> str | None:
    host = urlparse(url).netloc.lower()
    if not host:
        return None
    if "youtube.com" in host or "youtu.be" in host:
        return "YouTube"
    if "instagram.com" in host:
        return "Instagram"
    if "facebook.com" in host or "fb.watch" in host:
        return "Facebook"
    return None


def _extract_page_metadata(html_text: str) -> list[str]:
    metadata: list[str] = []

    page_title = _find_tag_content(html_text, "title")
    if page_title:
        metadata.append(f"title: {page_title}")

    meta_pairs = _find_meta_pairs(html_text)
    for key, value in meta_pairs:
        if value:
            metadata.append(f"{key}: {value}")

    json_ld_values = _extract_json_ld_values(html_text)
    metadata.extend(json_ld_values)

    unique_metadata: list[str] = []
    seen: set[str] = set()
    for item in metadata:
        cleaned_item = _clean_text(item)
        if not cleaned_item or cleaned_item in seen:
            continue
        seen.add(cleaned_item)
        unique_metadata.append(cleaned_item)
        if len(unique_metadata) >= MAX_METADATA_VALUES:
            break

    return unique_metadata


def _find_tag_content(html_text: str, tag_name: str) -> str:
    match = re.search(rf"<{tag_name}[^>]*>(.*?)</{tag_name}>", html_text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return _clean_text(html.unescape(match.group(1)))


def _find_meta_pairs(html_text: str) -> list[tuple[str, str]]:
    meta_pairs: list[tuple[str, str]] = []
    meta_pattern = re.compile(r"<meta\b([^>]*?)>", flags=re.IGNORECASE | re.DOTALL)
    attr_pattern = re.compile(r'(property|name|content)\s*=\s*["\']([^"\']+)["\']', flags=re.IGNORECASE)

    for meta_match in meta_pattern.finditer(html_text):
        attributes = dict((key.lower(), value) for key, value in attr_pattern.findall(meta_match.group(1)))
        content = attributes.get("content", "")
        key = attributes.get("property") or attributes.get("name")
        if not key or not content:
            continue
        if key.lower() in {"description", "og:title", "og:description", "twitter:title", "twitter:description", "article:tag"}:
            meta_pairs.append((key.lower(), _clean_text(content)))

    return meta_pairs


def _extract_json_ld_values(html_text: str) -> list[str]:
    values: list[str] = []
    script_pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        flags=re.IGNORECASE | re.DOTALL,
    )

    for script_match in script_pattern.finditer(html_text):
        raw_json = script_match.group(1).strip()
        if not raw_json:
            continue

        try:
            parsed_json = json.loads(raw_json)
        except json.JSONDecodeError:
            continue

        values.extend(_flatten_json_ld(parsed_json))

    return values


def _flatten_json_ld(value: Any) -> list[str]:
    flattened: list[str] = []

    if isinstance(value, dict):
        for key in ("name", "headline", "description", "recipeIngredient", "recipeInstructions", "text", "caption"):
            item = value.get(key)
            if not item:
                continue
            if isinstance(item, list):
                flattened.extend(_flatten_json_ld(item))
            elif isinstance(item, dict):
                flattened.extend(_flatten_json_ld(item))
            else:
                flattened.append(f"{key}: {_clean_text(str(item))}")

        for key in ("@graph", "mainEntity", "video", "author"):
            nested = value.get(key)
            if nested:
                flattened.extend(_flatten_json_ld(nested))
    elif isinstance(value, list):
        for item in value:
            flattened.extend(_flatten_json_ld(item))

    return flattened


def _strip_html(value: str) -> str:
    text = re.sub(r"<script.*?>.*?</script>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style.*?>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    text = html.unescape(str(value))
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"[\t\x0b\x0c]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalize_recipe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    recipe_name = str(payload.get("recipe_name", "")).strip()
    directions = str(payload.get("directions", "")).strip()

    if not recipe_name:
        raise SocialRecipeRipperError("Could not determine recipe name from social post")
    if not directions:
        raise SocialRecipeRipperError("Could not determine recipe directions from social post")

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