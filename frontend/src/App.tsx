import React, { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

interface Flashcard {
    id: number;
    question: string;
    answer: string;
    topic: string;
    difficulty: string;
    type: "core" | "extended";
}

interface GenerateResult {
    flashcards: Flashcard[];
    total: number;
    documents: { name: string; chars: number }[];
    mode: string;
    difficulty: string;
}

const difficultyColor = (d: string) => {
    if (d === "easy") return "#4ade80";
    if (d === "hard") return "#f87171";
    return "#fbbf24";
};

function UploadZone({
    files,
    onFilesChange,
}: {
    files: File[];
    onFilesChange: (files: File[]) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        const accepted = Array.from(incoming).filter((f) =>
            /\.(pdf|docx|txt)$/i.test(f.name),
        );
        const merged = [...files, ...accepted].filter(
            (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i,
        );
        onFilesChange(merged);
    };

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
        },
        [files],
    );

    return (
        <div>
            <div
                className={`upload-zone ${dragging ? "dragging" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <div className="upload-icon">⊕</div>
                <p className="upload-primary">
                    Drop documents here or click to browse
                </p>
                <p className="upload-secondary">Supports PDF · DOCX · TXT</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => addFiles(e.target.files)}
                />
            </div>
            {files.length > 0 && (
                <div className="file-list">
                    {files.map((f, i) => (
                        <div key={i} className="file-item">
                            <span className="file-ext">
                                {f.name.split(".").pop()?.toUpperCase()}
                            </span>
                            <span className="file-name">{f.name}</span>
                            <span className="file-size">
                                {(f.size / 1024).toFixed(0)}KB
                            </span>
                            <button
                                className="file-remove"
                                onClick={() =>
                                    onFilesChange(
                                        files.filter((_, j) => j !== i),
                                    )
                                }
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function FlashCard({ card, index }: { card: Flashcard; index: number }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <div
            className="card-wrapper"
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={() => setFlipped(!flipped)}
        >
            <div className={`card ${flipped ? "flipped" : ""}`}>
                <div className="card-face card-front">
                    <div className="card-header">
                        <span className="card-topic">{card.topic}</span>
                        <div className="card-badges">
                            <span
                                className="badge"
                                style={{
                                    background:
                                        difficultyColor(card.difficulty) + "22",
                                    color: difficultyColor(card.difficulty),
                                    border: `1px solid ${difficultyColor(card.difficulty)}44`,
                                }}
                            >
                                {card.difficulty}
                            </span>
                            {card.type === "extended" && (
                                <span
                                    className="badge"
                                    style={{
                                        background: "#a78bfa22",
                                        color: "#a78bfa",
                                        border: "1px solid #a78bfa44",
                                    }}
                                >
                                    extended
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="card-number">Q{card.id}</div>
                    <p className="card-question">{card.question}</p>
                    <div className="card-flip-hint">tap to reveal</div>
                </div>
                <div className="card-face card-back">
                    <div className="card-back-label">Answer</div>
                    <p className="card-answer">{card.answer}</p>
                    <div className="card-flip-hint">tap to flip back</div>
                </div>
            </div>
        </div>
    );
}

function StudyMode({
    cards,
    onExit,
}: {
    cards: Flashcard[];
    onExit: () => void;
}) {
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [score, setScore] = useState({ known: 0, review: 0 });
    const [done, setDone] = useState(false);
    const current = cards[index];
    const progress = (index / cards.length) * 100;

    const advance = (knew: boolean) => {
        setScore((s) => ({
            ...s,
            [knew ? "known" : "review"]: s[knew ? "known" : "review"] + 1,
        }));
        if (index + 1 >= cards.length) setDone(true);
        else {
            setIndex((i) => i + 1);
            setFlipped(false);
        }
    };

    if (done) {
        const pct = Math.round((score.known / cards.length) * 100);
        return (
            <div className="study-overlay">
                <div className="study-topbar">
                    <button className="btn-ghost" onClick={onExit}>
                        ← Back
                    </button>
                    <div className="study-progress-bar">
                        <div
                            className="study-progress-fill"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <span className="study-count">
                        {cards.length}/{cards.length}
                    </span>
                </div>
                <div className="study-body">
                    <div className="study-done">
                        <div className="study-done-icon">
                            {pct >= 70 ? "🎓" : "📚"}
                        </div>
                        <h2 className="study-done-title">Session Complete</h2>
                        <div className="study-score-grid">
                            <div className="study-score-item known">
                                <span className="study-score-num">
                                    {score.known}
                                </span>
                                <span>Known</span>
                            </div>
                            <div className="study-score-item review">
                                <span className="study-score-num">
                                    {score.review}
                                </span>
                                <span>Review</span>
                            </div>
                            <div className="study-score-item pct">
                                <span className="study-score-num">{pct}%</span>
                                <span>Score</span>
                            </div>
                        </div>
                        <button className="btn-primary" onClick={onExit}>
                            Back to Cards
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="study-overlay">
            {/* Top bar: exit + progress + count */}
            <div className="study-topbar">
                <button className="btn-ghost" onClick={onExit}>
                    ← Exit
                </button>
                <div className="study-progress-bar">
                    <div
                        className="study-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="study-count">
                    {index + 1}/{cards.length}
                </span>
            </div>

            {/* Card + actions */}
            <div className="study-body">
                <div
                    className="study-card-wrapper"
                    onClick={() => setFlipped(!flipped)}
                >
                    <div className={`study-card ${flipped ? "flipped" : ""}`}>
                        <div className="study-face study-front">
                            <div className="study-topic">{current.topic}</div>
                            <p className="study-question">{current.question}</p>
                            <p className="study-hint">tap to reveal answer</p>
                        </div>
                        <div className="study-face study-back">
                            <div className="study-back-label">Answer</div>
                            <p className="study-answer">{current.answer}</p>
                            <p className="study-hint">tap to flip back</p>
                        </div>
                    </div>
                </div>

                <div className="study-actions">
                    <button
                        className="study-btn review"
                        onClick={() => advance(false)}
                    >
                        <span className="study-btn-icon">✗</span> Review Again
                    </button>
                    <button
                        className="study-btn known"
                        onClick={() => advance(true)}
                    >
                        <span className="study-btn-icon">✓</span> Got It
                    </button>
                </div>
            </div>
        </div>
    );
}

function SettingsPanel({
    numCards,
    setNumCards,
    difficulty,
    setDifficulty,
    useLocalAI,
    setUseLocalAI,
    ollamaModel,
    setOllamaModel,
    ollamaAvailable,
}: any) {
    return (
        <div className="settings-panel">
            <div className="setting-row">
                <label className="setting-label">Cards to Generate</label>
                <div className="number-input-row">
                    <button
                        className="num-btn"
                        onClick={() => setNumCards(Math.max(5, numCards - 5))}
                    >
                        −
                    </button>
                    <span className="num-display">{numCards}</span>
                    <button
                        className="num-btn"
                        onClick={() => setNumCards(Math.min(30, numCards + 5))}
                    >
                        +
                    </button>
                </div>
            </div>
            <div className="setting-row">
                <label className="setting-label">Difficulty</label>
                <div className="diff-selector">
                    {["easy", "medium", "hard"].map((d) => (
                        <button
                            key={d}
                            className={`diff-btn ${difficulty === d ? "active" : ""}`}
                            style={
                                difficulty === d
                                    ? {
                                          background: difficultyColor(d) + "22",
                                          color: difficultyColor(d),
                                          borderColor:
                                              difficultyColor(d) + "88",
                                      }
                                    : {}
                            }
                            onClick={() => setDifficulty(d)}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>
            <div className="setting-row local-ai-row">
                <div className="local-ai-info">
                    <label className="setting-label">
                        Extend with Local AI
                    </label>
                    <p className="setting-desc">
                        Uses Ollama to generate inference, application &
                        critical thinking questions beyond the document scope
                    </p>
                </div>
                <div
                    className={`toggle ${useLocalAI ? "on" : ""}`}
                    onClick={() => setUseLocalAI(!useLocalAI)}
                >
                    <div className="toggle-thumb" />
                </div>
            </div>
            {useLocalAI && (
                <div className="setting-row">
                    <label className="setting-label">Ollama Model</label>
                    <div className="model-status">
                        <span
                            className={`status-dot ${ollamaAvailable ? "green" : "red"}`}
                        />
                        <input
                            className="model-input"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="llama3"
                        />
                        {!ollamaAvailable && (
                            <p className="ollama-warning">
                                ⚠ Ollama not detected. Run: ollama serve
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function App() {
    const [files, setFiles] = useState<File[]>([]);
    const [numCards, setNumCards] = useState(10);
    const [difficulty, setDifficulty] = useState("medium");
    const [useLocalAI, setUseLocalAI] = useState(true);
    const [ollamaModel, setOllamaModel] = useState("llama3");
    const [ollamaAvailable, setOllamaAvailable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<GenerateResult | null>(null);
    const [studyMode, setStudyMode] = useState(false);
    const [filterType, setFilterType] = useState<"all" | "core" | "extended">(
        "all",
    );
    const [view, setView] = useState<"grid" | "list">("grid");
    const [progress, setProgress] = useState(0);
    const progressRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        axios
            .get(`${API_BASE}/ollama-models`)
            .then((r) => setOllamaAvailable(r.data.available))
            .catch(() => setOllamaAvailable(false));
    }, []);

    const simulateProgress = () => {
        setProgress(0);
        let p = 0;
        progressRef.current = setInterval(() => {
            p += Math.random() * 8;
            if (p >= 90) {
                clearInterval(progressRef.current!);
                p = 90;
            }
            setProgress(p);
        }, 400);
    };

    const generate = async () => {
        if (files.length === 0) {
            setError("Please upload at least one document.");
            return;
        }
        setError("");
        setLoading(true);
        setResult(null);
        simulateProgress();
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        form.append("num_cards", String(numCards));
        form.append("difficulty", difficulty);
        form.append("use_local_ai", String(useLocalAI));
        form.append("ollama_model", ollamaModel);
        try {
            const res = await axios.post<GenerateResult>(
                `${API_BASE}/generate-flashcards`,
                form,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                    timeout: 120000,
                },
            );
            clearInterval(progressRef.current!);
            setProgress(100);
            setTimeout(() => {
                setResult(res.data);
                setLoading(false);
                setProgress(0);
            }, 400);
        } catch (err: any) {
            clearInterval(progressRef.current!);
            setProgress(0);
            setLoading(false);
            setError(
                err.response?.data?.detail ||
                    err.message ||
                    "Generation failed",
            );
        }
    };

    const filteredCards =
        result?.flashcards.filter((c) =>
            filterType === "all" ? true : c.type === filterType,
        ) ?? [];

    if (studyMode && result) {
        return (
            <StudyMode
                cards={filteredCards}
                onExit={() => setStudyMode(false)}
            />
        );
    }

    return (
        <div className="app">
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <span className="logo-mark">⬡</span>
                        <span className="logo-text">CardForge</span>
                    </div>
                    <div className="header-tagline">AI Flashcard Generator</div>
                </div>
            </header>
            <main className="main">
                {!result ? (
                    <div className="setup-screen">
                        <div className="setup-hero">
                            <h1 className="hero-title">
                                Turn Documents
                                <br />
                                <em>into Knowledge</em>
                            </h1>
                            <p className="hero-sub">
                                Upload your study materials and let AI craft
                                perfect flashcards tailored to your learning
                                level.
                            </p>
                        </div>
                        <div className="setup-card">
                            <section className="setup-section">
                                <h3 className="section-title">
                                    <span className="step-num">01</span> Upload
                                    Documents
                                </h3>
                                <UploadZone
                                    files={files}
                                    onFilesChange={setFiles}
                                />
                            </section>
                            <div className="section-divider" />
                            <section className="setup-section">
                                <h3 className="section-title">
                                    <span className="step-num">02</span>{" "}
                                    Configure
                                </h3>
                                <SettingsPanel
                                    numCards={numCards}
                                    setNumCards={setNumCards}
                                    difficulty={difficulty}
                                    setDifficulty={setDifficulty}
                                    useLocalAI={useLocalAI}
                                    setUseLocalAI={setUseLocalAI}
                                    ollamaModel={ollamaModel}
                                    setOllamaModel={setOllamaModel}
                                    ollamaAvailable={ollamaAvailable}
                                />
                            </section>
                            {error && <div className="error-box">{error}</div>}
                            <button
                                className={`btn-generate ${loading ? "loading" : ""}`}
                                onClick={generate}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner" />
                                        Generating
                                        {useLocalAI ? " with Local AI" : ""}…
                                        <span className="progress-inline">
                                            {Math.round(progress)}%
                                        </span>
                                    </>
                                ) : (
                                    <>Generate {numCards} Flashcards →</>
                                )}
                            </button>
                            {loading && (
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="results-screen">
                        <div className="results-header">
                            <div>
                                <h2 className="results-title">
                                    {result.total} Flashcards Ready
                                </h2>
                                <div className="results-meta">
                                    {result.documents.map((d) => (
                                        <span
                                            key={d.name}
                                            className="meta-pill"
                                        >
                                            {d.name}
                                        </span>
                                    ))}
                                    <span className="meta-pill mode-pill">
                                        {result.mode === "local_ai"
                                            ? "🖥 Local AI"
                                            : "☁ Cloud AI"}
                                    </span>
                                    <span
                                        className="meta-pill"
                                        style={{
                                            color: difficultyColor(
                                                result.difficulty,
                                            ),
                                        }}
                                    >
                                        {result.difficulty}
                                    </span>
                                </div>
                            </div>
                            <div className="results-actions">
                                <button
                                    className="btn-ghost"
                                    onClick={() => {
                                        setResult(null);
                                        setFiles([]);
                                    }}
                                >
                                    ← New Session
                                </button>
                                <div className="view-toggle">
                                    <button
                                        className={`view-btn ${view === "grid" ? "active" : ""}`}
                                        onClick={() => setView("grid")}
                                    >
                                        ⊞
                                    </button>
                                    <button
                                        className={`view-btn ${view === "list" ? "active" : ""}`}
                                        onClick={() => setView("list")}
                                    >
                                        ☰
                                    </button>
                                </div>
                                <button
                                    className="btn-study"
                                    onClick={() => setStudyMode(true)}
                                >
                                    Study Mode →
                                </button>
                            </div>
                        </div>
                        {result.flashcards.some(
                            (c) => c.type === "extended",
                        ) && (
                            <div className="filter-bar">
                                {(["all", "core", "extended"] as const).map(
                                    (t) => (
                                        <button
                                            key={t}
                                            className={`filter-btn ${filterType === t ? "active" : ""}`}
                                            onClick={() => setFilterType(t)}
                                        >
                                            {t === "all"
                                                ? `All (${result.total})`
                                                : t === "core"
                                                  ? `Core (${result.flashcards.filter((c) => c.type === "core").length})`
                                                  : `Extended (${result.flashcards.filter((c) => c.type === "extended").length})`}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}
                        <div className={`cards-grid ${view}`}>
                            {filteredCards.map((card, i) => (
                                <FlashCard
                                    key={card.id}
                                    card={card}
                                    index={i}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>
            <footer className="footer">
                <span>CardForge · Powered by Ollama</span>
            </footer>
        </div>
    );
}
