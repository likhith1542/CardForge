<div align="center">

# ⬡ CardForge

**AI-powered flashcard generator from your documents**

Turn PDFs, Word docs, and text files into study-ready flashcards in seconds.  
Powered by Anthropic Claude (cloud) or Ollama (local, private).

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## Features

- **Multi-document upload** — drag & drop multiple PDF, DOCX, or TXT files at once; content is combined and analysed together
- **Dual AI modes** — use Anthropic Claude for cloud generation, or switch to Ollama for fully local, private inference
- **Extended question scope** — when Local AI is enabled, Ollama generates additional inference, application, and critical-thinking questions that go *beyond* the document text
- **Difficulty levels** — Easy (recall & definitions), Medium (understanding & relationships), Hard (analysis & synthesis)
- **3D flip cards** — smooth CSS perspective flip animation; tap any card to reveal the answer
- **Study Mode** — fullscreen spaced-repetition session with "Got It / Review Again" scoring and a results summary
- **Grid & List views** — browse cards in either layout; filter between Core and Extended cards
- **Clean dark UI** — editorial aesthetic with Playfair Display serif headings and DM Mono accents

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, CSS (no UI library) |
| Backend | Python 3.9+, FastAPI, Uvicorn |
| Cloud AI | Anthropic Claude (`claude-opus-4-5`) |
| Local AI | Ollama (`llama3`, `mistral`, or any model) |
| PDF parsing | pdfplumber |
| DOCX parsing | python-docx |
| HTTP client | httpx (async) |
| Containerisation | Docker + Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- An [Anthropic API key](https://console.anthropic.com/) — for cloud mode
- [Ollama](https://ollama.ai) installed and running — for local mode

---

### Option A — Run locally (dev)

#### 1. Clone the repo

```bash
git clone https://github.com/likhith1542/cardforge.git
cd cardforge
```

#### 2. Start the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...   # Windows: set ANTHROPIC_API_KEY=sk-ant-...

# Start the server
uvicorn main:app --reload --port 8000
```

Backend available at `http://localhost:8000`  
Interactive API docs at `http://localhost:8000/docs`

#### 3. Start the frontend

```bash
# In a new terminal, from the project root
cd frontend
npm install
npm start
```

Frontend available at `http://localhost:3000`

---

### Option B — Docker Compose

```bash
# From the project root
export ANTHROPIC_API_KEY=sk-ant-...

docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

### Local AI Setup (Ollama)

To use Local AI mode with extended question generation:

```bash
# 1. Install Ollama — https://ollama.ai

# 2. Pull a model
ollama pull llama3        # recommended — fast, well-rounded
ollama pull mistral       # great for reasoning tasks
ollama pull phi3          # lightweight, runs on modest hardware
ollama pull gemma         # Google's open model

# 3. Start the server
ollama serve
```

Toggle **"Extend with Local AI"** in the app and type your model name. The status dot turns green when Ollama is detected.

> **Tip:** The model name must match `ollama list` output (e.g. `llama3`). Tag suffixes like `:latest` are handled automatically.

---

## Project Structure

```
cardforge/
├── backend/
│   ├── main.py               # FastAPI app — parsing, AI routing, all endpoints
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.tsx           # Full React app — all components and state
│   │   └── index.css         # Design system — tokens, layout, animations
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## API Reference

### `POST /generate-flashcards`

Accepts a `multipart/form-data` upload. Returns generated flashcards.

| Field | Type | Default | Description |
|---|---|---|---|
| `files` | `File[]` | required | One or more PDF / DOCX / TXT files |
| `num_cards` | `int` | `10` | Number of flashcards to generate (5–30) |
| `difficulty` | `string` | `medium` | `easy` · `medium` · `hard` |
| `use_local_ai` | `bool` | `true` | Route to Ollama instead of Claude |
| `ollama_model` | `string` | `llama3` | Model name as shown in `ollama list` |

**Response**

```jsonc
{
  "flashcards": [
    {
      "id": 1,
      "question": "What is a binary search tree?",
      "answer": "A BST is a binary tree where every left child node is smaller...",
      "topic": "Data Structures",
      "difficulty": "medium",
      "type": "core"       // "extended" for Ollama inference questions
    }
  ],
  "total": 10,
  "documents": [{ "name": "lecture.pdf", "chars": 8240 }],
  "mode": "local_ai",     // or "cloud_ai"
  "difficulty": "medium"
}
```

### `GET /ollama-models`

Returns availability and list of locally pulled Ollama models.

```jsonc
{ "available": true, "models": ["llama3", "mistral"] }
```

### `GET /health`

```jsonc
{ "status": "ok" }
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (cloud mode) | Get one at [console.anthropic.com](https://console.anthropic.com) |

---

## Configuration

| Setting | File | Key | Default |
|---|---|---|---|
| Max document context | `backend/main.py` | `text[:12000]` | 12,000 chars |
| Card count range | `frontend/src/App.tsx` | `num-btn` handlers | 5 – 30 |
| Claude model | `backend/main.py` | `generate_with_anthropic` | `claude-opus-4-5` |
| Default Ollama model | `backend/main.py` | `generate_with_ollama` | `llama3` |
| Ollama host | `backend/main.py` | hardcoded URL | `localhost:11434` |
| Request timeout | `backend/main.py` | `AsyncClient(timeout=…)` | 180s |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

1. Fork the repo
2. Create your feature branch — `git checkout -b feat/your-feature`
3. Commit your changes — `git commit -m 'feat: add your feature'`
4. Push to the branch — `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

[MIT](LICENSE) © 2025 [Likhith](https://github.com/likhith1542)