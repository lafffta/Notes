import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import katex from "katex";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const initialMarkdown = `---
id: 01K0PROTOTYPE7V5K7T9N1
title: Harmonic Oscillator
tags: [physics, differential-equations]
---

# Harmonic Oscillator

The oscillator stores energy by trading kinetic and potential terms.

> **Goal:** keep the Markdown source obvious while making the mathematics effortless to inspect.

For displacement $x(t)$, the equation of motion is

$$
m\\frac{d^2x}{dt^2} + kx = 0.
$$

Its angular frequency is $\\omega = \\sqrt{k/m}$ and one solution is

$$
x(t) = A\\cos(\\omega t + \\phi).
$$

## Working notes

- [x] Preserve ordinary Markdown
- [x] Render inline and display mathematics
- [ ] Decide how preview and source share the window

An intentionally invalid expression should remain visible instead of breaking the note: $\\notARealCommand{x}$.

| Symbol | Meaning |
| --- | --- |
| $m$ | mass |
| $k$ | spring constant |
| $A$ | amplitude |
`;

const variantNames = {
  A: "Split workbench",
  B: "Focus toggle",
  C: "Reading desk",
} as const;

type VariantKey = keyof typeof variantNames;

function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const extensions = useMemo(() => [markdown(), EditorView.lineWrapping], []);

  return (
    <CodeMirror
      aria-label="Markdown source"
      className="code-editor"
      extensions={extensions}
      height="100%"
      onChange={onChange}
      value={value}
      basicSetup={{
        bracketMatching: true,
        closeBrackets: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        lineNumbers: true,
        searchKeymap: true,
      }}
    />
  );
}

function MarkdownPreview({ source }: { source: string }) {
  const visibleSource = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

  return (
    <article className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
      >
        {visibleSource}
      </ReactMarkdown>
    </article>
  );
}

function countMathErrors(source: string) {
  const expressions = [...source.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)];

  return expressions.filter((match) => {
    const expression = match[1] ?? match[2] ?? "";
    try {
      katex.renderToString(expression, { throwOnError: true, displayMode: Boolean(match[1]) });
      return false;
    } catch {
      return true;
    }
  }).length;
}

function StatusStrip({ source, mode }: { source: string; mode: string }) {
  const lines = source.split("\n").length;
  const errors = countMathErrors(source);

  return (
    <div className="status-strip" aria-label="Prototype state">
      <span>{mode}</span>
      <span>{lines} lines</span>
      <span>{source.length} characters</span>
      <span className={errors ? "status-warning" : ""}>
        {errors ? `${errors} recoverable math error` : "Math valid"}
      </span>
      <span>In-memory only</span>
    </div>
  );
}

function NoteList() {
  return (
    <nav className="note-list" aria-label="Prototype Vault">
      <div className="vault-title">Physics Vault</div>
      <label className="search-shell">
        <span>⌕</span>
        <input aria-label="Search notes" placeholder="Search notes" />
      </label>
      <div className="folder-label">Mechanics</div>
      <button className="note-row active" type="button">
        <strong>Harmonic Oscillator</strong>
        <span>Physics / Mechanics</span>
      </button>
      <button className="note-row" type="button">
        <strong>Lagrangian Notes</strong>
        <span>Physics / Mechanics</span>
      </button>
      <div className="folder-label">Calculus</div>
      <button className="note-row" type="button">
        <strong>Gaussian Integral</strong>
        <span>Calculus</span>
      </button>
    </nav>
  );
}

function VariantA({ source, setSource }: EditorVariantProps) {
  return (
    <main className="variant variant-a">
      <NoteList />
      <section className="pane source-pane">
        <PaneHeader eyebrow="Markdown source" title="Harmonic Oscillator" detail="harmonic-oscillator.md" />
        <MarkdownEditor value={source} onChange={setSource} />
      </section>
      <section className="pane preview-pane">
        <PaneHeader eyebrow="Live preview" title="Rendered note" detail="Updates while you type" />
        <div className="preview-scroll">
          <MarkdownPreview source={source} />
        </div>
      </section>
      <StatusStrip source={source} mode="Side-by-side" />
    </main>
  );
}

function VariantB({ source, setSource }: EditorVariantProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <main className="variant variant-b">
      <header className="focus-header">
        <div>
          <span className="breadcrumb">Physics Vault / Mechanics</span>
          <h1>Harmonic Oscillator</h1>
        </div>
        <div className="mode-toggle" aria-label="Editing mode">
          <button className={mode === "write" ? "active" : ""} onClick={() => setMode("write")} type="button">
            Write
          </button>
          <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")} type="button">
            Preview
          </button>
        </div>
      </header>
      <div className="focus-tools" aria-label="Note controls">
        <button type="button">☰ Notes</button>
        <span>harmonic-oscillator.md</span>
        <span className="saved-state">● In-memory prototype</span>
      </div>
      <section className={`focus-canvas ${mode}`}>
        {mode === "write" ? (
          <MarkdownEditor value={source} onChange={setSource} />
        ) : (
          <div className="preview-scroll centered-preview">
            <MarkdownPreview source={source} />
          </div>
        )}
      </section>
      <StatusStrip source={source} mode={mode === "write" ? "Focused writing" : "Focused preview"} />
    </main>
  );
}

function VariantC({ source, setSource }: EditorVariantProps) {
  return (
    <main className="variant variant-c">
      <header className="desk-header">
        <div className="horizontal-notes" aria-label="Open notes">
          <button type="button">Gaussian Integral</button>
          <button className="active" type="button">Harmonic Oscillator</button>
          <button type="button">Lagrangian Notes</button>
        </div>
        <span>Physics Vault</span>
      </header>
      <div className="reading-desk">
        <section className="desk-section source-card">
          <PaneHeader eyebrow="Compose" title="Source" detail="Markdown remains visible" />
          <MarkdownEditor value={source} onChange={setSource} />
        </section>
        <div className="flow-marker" aria-hidden="true">↓ renders continuously</div>
        <section className="desk-section paper-card">
          <PaneHeader eyebrow="Read" title="Preview" detail="Document-width canvas" />
          <MarkdownPreview source={source} />
        </section>
      </div>
      <StatusStrip source={source} mode="Stacked reading desk" />
    </main>
  );
}

function PaneHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="pane-header">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <small>{detail}</small>
    </header>
  );
}

type EditorVariantProps = {
  source: string;
  setSource: (value: string) => void;
};

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (next: VariantKey) => void }) {
  const variants = Object.keys(variantNames) as VariantKey[];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const currentIndex = variants.indexOf(current);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + variants.length) % variants.length;
      onChange(variants[nextIndex]);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [current, onChange, variants]);

  if (import.meta.env.PROD) return null;

  const currentIndex = variants.indexOf(current);
  const cycle = (direction: number) => {
    const nextIndex = (currentIndex + direction + variants.length) % variants.length;
    onChange(variants[nextIndex]);
  };

  return (
    <div className="prototype-switcher" aria-label="Prototype variant switcher">
      <button aria-label="Previous variant" onClick={() => cycle(-1)} type="button">←</button>
      <span><strong>{current}</strong> — {variantNames[current]}</span>
      <button aria-label="Next variant" onClick={() => cycle(1)} type="button">→</button>
    </div>
  );
}

function readVariant(): VariantKey {
  const requested = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return requested && requested in variantNames ? (requested as VariantKey) : "A";
}

export default function App() {
  const [source, setSource] = useState(initialMarkdown);
  const [variant, setVariant] = useState<VariantKey>(readVariant);

  const changeVariant = (next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    setVariant(next);
  };

  return (
    <div className="prototype-shell">
      <div className="prototype-ribbon">THROWAWAY UI PROTOTYPE · no files are saved</div>
      {variant === "A" && <VariantA source={source} setSource={setSource} />}
      {variant === "B" && <VariantB source={source} setSource={setSource} />}
      {variant === "C" && <VariantC source={source} setSource={setSource} />}
      <PrototypeSwitcher current={variant} onChange={changeVariant} />
    </div>
  );
}
