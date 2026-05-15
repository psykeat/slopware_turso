from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import litellm
import os

app = FastAPI()

class CompletionRequest(BaseModel):
    prompt: str
    model: str = "openai/gpt-4o-mini"
    endpoint_url: str | None = None

class CompletionResponse(BaseModel):
    content: str

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/complete", response_model=CompletionResponse)
async def complete(req: CompletionRequest):
    try:
        if req.endpoint_url:
            litellm.api_base = req.endpoint_url
        response = litellm.completion(
            model=req.model,
            messages=[{"role": "user", "content": req.prompt}],
        )
        return CompletionResponse(content=response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
