# CardForge — AI Flashcard Generator

Turn your study documents (PDF, DOCX, TXT) into AI-generated flashcards with a single click. Supports both cloud AI (Anthropic Claude) and local AI (Ollama) for extended question generation.

---

## Features

- **Multi-document upload** — drag & drop PDF, DOCX, TXT files
- **Smart flashcard generation** — question, answer, topic label, difficulty tag
- **Difficulty modes** — Easy, Medium, Hard
- **Local AI extension** — toggle Ollama to add inference, application, and critical-thinking questions beyond the document scope
- **Study Mode** — spaced-repetition style "Got It / Review Again" session with score summary
- **Grid & List views** — browse all cards, filter by Core vs Extended
- **3D flip animation** — tap any card to reveal the answer

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript |
| Backend | FastAPI (Python) |
| Cloud AI | Anthropic Claude (claude-opus-4-5) |
| Local AI | Ollama (llama3 or any model) |
| PDF parsing | pdfplumber |
| DOCX parsing | python-docx |

---

## Quick Start (Local Dev)

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## Docker Compose (Recommended for Production)

```bash
# Set env variable
export ANTHROPIC_API_KEY=sk-ant-...

# Build and run
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

---

## Local AI (Ollama) Setup

To enable extended question scope:

1. Install Ollama: https://ollama.ai
2. Pull a model:
   ```bash
   ollama pull llama3
   # or: ollama pull mistral, phi3, gemma, etc.
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. Toggle "Extend with Local AI" in the app and enter your model name

Ollama runs at http://localhost:11434 by default.

---

## API Reference

### POST /generate-flashcards

**Form fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| files | File[] | required | PDF/DOCX/TXT files |
| num_cards | int | 10 | Number of flashcards (5–30) |
| difficulty | string | medium | easy / medium / hard |
| use_local_ai | bool | false | Enable Ollama extension |
| ollama_model | string | llama3 | Ollama model name |

**Response:**
```json
{
  "flashcards": [
    {
      "id": 1,
      "question": "What is photosynthesis?",
      "answer": "The process by which plants convert sunlight...",
      "topic": "Biology",
      "difficulty": "easy",
      "type": "core"
    }
  ],
  "total": 10,
  "documents": [{"name": "bio.pdf", "chars": 4200}],
  "mode": "cloud_ai",
  "difficulty": "easy"
}
```

### GET /ollama-models

Returns `{ available: bool, models: string[] }`

---

## Project Structure

```
flashcard-app/
├── backend/
│   ├── main.py           # FastAPI app + all routes
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Full React app (components + logic)
│   │   └── index.css     # Dark editorial design system
│   └── Dockerfile
└── docker-compose.yml
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| ANTHROPIC_API_KEY | Yes | Your Anthropic API key |

---

## Customization

- **Max document length**: Edit the `text[:12000]` slice in `build_prompt()` to increase context
- **Card count limits**: Adjust `min/max` in the settings panel (`App.tsx`)
- **Ollama host**: Change `http://localhost:11434` in `main.py` if Ollama is remote
- **Model**: Default is `claude-opus-4-5`; edit in `generate_with_anthropic()`