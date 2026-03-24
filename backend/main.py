from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import anthropic
import httpx
import json
import io
import re

# PDF & DOCX parsing
try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

app = FastAPI(title="Flashcard Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_CLIENT = anthropic.Anthropic()

# ─── Text Extraction ─────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    if not PDF_AVAILABLE:
        raise HTTPException(status_code=500, detail="pdfplumber not installed")
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n\n"
    return text.strip()

def extract_text_from_docx(file_bytes: bytes) -> str:
    if not DOCX_AVAILABLE:
        raise HTTPException(status_code=500, detail="python-docx not installed")
    doc = DocxDocument(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)

def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace")

def extract_text(filename: str, file_bytes: bytes) -> str:
    fn = filename.lower()
    if fn.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif fn.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    elif fn.endswith(".txt"):
        return extract_text_from_txt(file_bytes)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {filename}")

# ─── Prompt Building ──────────────────────────────────────────────────────────

def build_prompt(text: str, num_cards: int, difficulty: str, use_local_ai: bool) -> str:
    scope_extension = ""
    if use_local_ai:
        scope_extension = """
Also generate EXTENDED questions that go BEYOND the document text:
- Inference and implication questions (what can we deduce?)
- Comparison and contrast questions (how does this relate to general knowledge?)
- Application questions (how would you apply this concept?)
- Critical thinking and evaluation questions
- "What if" scenario questions
- Questions connecting concepts across the document
Label these extended questions with type: "extended".
"""

    return f"""You are an expert educator and flashcard creator. Analyze the provided document text and generate exactly {num_cards} high-quality flashcards.

Difficulty level: {difficulty.upper()}
- easy: basic recall, definitions, simple facts
- medium: understanding, explanation, relationships between concepts
- hard: analysis, synthesis, application, edge cases

{scope_extension}

Document text:
---
{text[:12000]}
---

Generate exactly {num_cards} flashcards. Respond ONLY with a valid JSON array, no markdown, no preamble.
Each flashcard object must have exactly these fields:
{{
  "id": <number>,
  "question": "<the question>",
  "answer": "<comprehensive answer>",
  "topic": "<brief topic label, 1-3 words>",
  "difficulty": "{difficulty}",
  "type": "core" | "extended"
}}

Return only the JSON array. Example:
[{{"id":1,"question":"...","answer":"...","topic":"...","difficulty":"{difficulty}","type":"core"}}]"""

# ─── Cloud AI (Anthropic) ─────────────────────────────────────────────────────

def generate_with_anthropic(prompt: str) -> List[dict]:
    message = ANTHROPIC_CLIENT.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)

# ─── Local AI (Ollama) ────────────────────────────────────────────────────────

def _parse_ollama_raw(raw: str) -> List[dict]:
    """Strip markdown fences and extract JSON array from Ollama response."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return json.loads(raw)

async def generate_with_ollama(prompt: str, model: str = "llama3") -> List[dict]:
    async with httpx.AsyncClient(timeout=180.0) as client:
        # First check Ollama is reachable and model exists
        try:
            tags_resp = await client.get("http://localhost:11434/api/tags")
            available_models = [m["name"] for m in tags_resp.json().get("models", [])]
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="Ollama is not running. Start it with: ollama serve"
            )

        # Check if requested model is available (match with or without tag suffix)
        model_found = any(
            m == model or m.startswith(model + ":") or model.startswith(m.split(":")[0])
            for m in available_models
        )
        if not model_found:
            available = ", ".join(available_models) if available_models else "none"
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Model '{model}' is not pulled in Ollama. "
                    f"Run: ollama pull {model}\n"
                    f"Available models: {available}"
                )
            )

        # Try /api/chat first (newer Ollama), fall back to /api/generate
        try:
            resp = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 4096}
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("message", {}).get("content", "").strip()
                return _parse_ollama_raw(raw)
        except Exception:
            pass  # Fall through to /api/generate

        try:
            resp = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 4096}
                }
            )
            resp.raise_for_status()
            data = resp.json()
            raw = data.get("response", "").strip()
            return _parse_ollama_raw(raw)
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Ollama request failed ({e.response.status_code}). Check that '{model}' is pulled: ollama pull {model}"
            )
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Local AI returned malformed JSON: {str(e)}"
            )

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/generate-flashcards")
async def generate_flashcards(
    files: List[UploadFile] = File(...),
    num_cards: int = Form(default=10),
    difficulty: str = Form(default="medium"),
    use_local_ai: bool = Form(default=False),
    ollama_model: str = Form(default="llama3"),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # Validate
    allowed_extensions = {".pdf", ".docx", ".txt"}
    for f in files:
        ext = "." + f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not supported. Only PDF, DOCX, TXT allowed."
            )

    # Extract text from all documents
    combined_text = ""
    file_summaries = []
    for f in files:
        raw = await f.read()
        text = extract_text(f.filename, raw)
        combined_text += f"\n\n=== Document: {f.filename} ===\n\n{text}"
        file_summaries.append({"name": f.filename, "chars": len(text)})

    if len(combined_text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Documents appear to be empty or unreadable.")

    prompt = build_prompt(combined_text, num_cards, difficulty, use_local_ai)

    if use_local_ai:
        flashcards = await generate_with_ollama(prompt, ollama_model)
    else:
        flashcards = generate_with_anthropic(prompt)

    # Ensure IDs are set
    for i, card in enumerate(flashcards):
        card["id"] = i + 1

    return JSONResponse({
        "flashcards": flashcards,
        "total": len(flashcards),
        "documents": file_summaries,
        "mode": "local_ai" if use_local_ai else "cloud_ai",
        "difficulty": difficulty,
    })

@app.get("/ollama-models")
async def get_ollama_models():
    """Check Ollama availability and list models."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get("http://localhost:11434/api/tags")
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"available": True, "models": models}
        except Exception:
            return {"available": False, "models": []}