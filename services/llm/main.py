from contextlib import contextmanager
from pathlib import Path
import json
import tempfile

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import litellm
import os
import traceback

litellm.set_verbose = True

app = FastAPI()

class CompletionRequest(BaseModel):
    prompt: str
    model: str = "openai/gpt-4o-mini"
    endpoint_url: str | None = None
    provider: str | None = None
    api_key: str | None = None
    vertex_credentials: str | None = None
    vertex_project: str | None = None
    vertex_location: str | None = None
    max_tokens: int | None = None
    direct_vertex_test: bool | None = None

class CompletionResponse(BaseModel):
    content: str
    usage: dict[str, int] | None = None
    model: str | None = None
    provider: str | None = None


@contextmanager
def temporary_environment(overrides: dict[str, str | None]):
    original_values: dict[str, str | None] = {}
    missing = object()

    for key, value in overrides.items():
        if value is None or value == "":
            continue
        original_values[key] = os.environ.get(key, missing)  # type: ignore[assignment]
        os.environ[key] = value

    try:
        yield
    finally:
        for key, original in original_values.items():
            if original is missing:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original


@contextmanager
def temporary_vertex_credentials(credentials: str | None):
    if not credentials:
        yield None
        return

    candidate = credentials.strip()
    if not candidate:
        yield None
        return

    if Path(candidate).is_file():
        previous = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = candidate
        try:
          yield candidate
        finally:
          if previous is None:
              os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
          else:
              os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = previous
        return

    try:
        parsed = json.loads(candidate)
    except Exception as exc:
        raise ValueError(
            "vertex_credentials must be a service-account JSON string or a path to a JSON file"
        ) from exc

    if not isinstance(parsed, dict):
        raise ValueError("vertex_credentials must decode to a JSON object")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as handle:
        json.dump(parsed, handle)
        temp_path = handle.name

    previous = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
    try:
        yield temp_path
    finally:
        if previous is None:
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
        else:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = previous
        try:
            Path(temp_path).unlink(missing_ok=True)
        except Exception:
            pass


def infer_provider(model: str, provider: str | None) -> str:
    prefix = model.split("/", 1)[0] if "/" in model else ""
    if prefix == "vertex_ai":
        return "vertex_ai"
    if prefix == "gemini":
        return "google_ai_studio"
    if prefix == "openai":
        return "openai"
    if provider:
        return provider
    return "openai"


def normalize_model(model: str, provider: str) -> str:
    if "/" in model:
        return model
    if provider == "vertex_ai":
        return f"vertex_ai/{model}"
    if provider == "google_ai_studio":
        return f"gemini/{model}"
    return f"openai/{model}"


def extract_text_from_vertex_response(response: object) -> str | None:
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text

    candidates = getattr(response, "candidates", None)
    if not candidates:
        return None

    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
          continue
        chunks: list[str] = []
        for part in parts:
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str):
                chunks.append(part_text)
        if chunks:
            return "".join(chunks)

    return None


def direct_vertex_completion(req: CompletionRequest, model: str) -> tuple[str, str | None]:
    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True,
        project=req.vertex_project,
        location=req.vertex_location or os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    config = types.GenerateContentConfig(
        temperature=0,
        max_output_tokens=req.max_tokens or 8,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    response = client.models.generate_content(
        model=model.split("/", 1)[1] if "/" in model else model,
        contents=req.prompt,
        config=config,
    )
    text = extract_text_from_vertex_response(response)
    if not text:
        raise RuntimeError(f"Vertex returned no text. finish_reason={getattr(response.candidates[0], 'finish_reason', None) if getattr(response, 'candidates', None) else None}")
    response_model = getattr(response, "model_version", None) or getattr(response, "model", None)
    return text, response_model

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/complete", response_model=CompletionResponse)
async def complete(req: CompletionRequest):
    provider = req.provider or ""
    model = req.model
    try:
        provider = infer_provider(req.model, req.provider)
        model = normalize_model(req.model, provider)
        env_overrides = {
        "OPENAI_API_KEY": req.api_key if provider == "openai" else None,
        "GOOGLE_API_KEY": req.api_key if provider == "google_ai_studio" else None,
        "GEMINI_API_KEY": req.api_key if provider == "google_ai_studio" else None,
        "VERTEXAI_PROJECT": req.vertex_project if provider == "vertex_ai" else None,
        "VERTEXAI_LOCATION": req.vertex_location if provider == "vertex_ai" else None,
        "GOOGLE_CLOUD_PROJECT": req.vertex_project if provider == "vertex_ai" else None,
        "GOOGLE_CLOUD_LOCATION": req.vertex_location if provider == "vertex_ai" else None,
        "GOOGLE_CLOUD_QUOTA_PROJECT": req.vertex_project if provider == "vertex_ai" else None,
        "GOOGLE_GENAI_USE_VERTEXAI": "True" if provider == "vertex_ai" else None,
    }
        with temporary_environment(env_overrides), temporary_vertex_credentials(req.vertex_credentials):
            if provider == "vertex_ai" and req.direct_vertex_test:
                text, response_model = direct_vertex_completion(req, model)
                return CompletionResponse(content=text, model=response_model, provider=provider)

            completion_kwargs = {
                "model": model,
                "messages": [{"role": "user", "content": req.prompt}],
            }
            if req.max_tokens is not None:
                completion_kwargs["max_tokens"] = req.max_tokens
            if req.api_key and provider in {"openai", "google_ai_studio"}:
                completion_kwargs["api_key"] = req.api_key

            response = litellm.completion(**completion_kwargs)

        usage = None
        if getattr(response, "usage", None):
            usage = {
                "prompt_tokens": int(getattr(response.usage, "prompt_tokens", 0) or 0),
                "completion_tokens": int(getattr(response.usage, "completion_tokens", 0) or 0),
                "total_tokens": int(getattr(response.usage, "total_tokens", 0) or 0),
            }

        return CompletionResponse(
            content=response.choices[0].message.content,
            usage=usage,
            model=getattr(response, "model", model),
            provider=provider,
        )
    except Exception as e:
        traceback.print_exc()
        detail = str(e)
        if "Extra data" in detail and provider == "vertex_ai":
            detail = (
                "Vertex credentials parsing failed. Provide either a service-account JSON object "
                "or a filesystem path to the JSON file, or rely on ADC via gcloud auth application-default."
            )
        status_code = 502
        if provider == "vertex_ai" and (
            "RESOURCE_EXHAUSTED" in detail or "429" in detail or "quota" in detail.lower()
        ):
            status_code = 429
            detail = (
                f"Vertex quota exhausted or not assigned to the configured project ({req.vertex_project or 'unset'}). "
                "If you are using ADC, run `gcloud auth application-default set-quota-project <project-id>` "
                "or set GOOGLE_CLOUD_QUOTA_PROJECT to the billing project."
            )
        return JSONResponse(
            status_code=status_code,
            content={
                "error": "LiteLLM completion failed",
                "detail": detail,
                "model": model,
                "endpoint_url": req.endpoint_url,
                "provider": provider,
                "vertex_project": req.vertex_project,
                "vertex_location": req.vertex_location,
            },
        )
