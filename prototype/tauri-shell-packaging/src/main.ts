import { open } from "@tauri-apps/plugin-dialog";
import {
  readDir,
  readTextFile,
  watch,
  type DirEntry,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import "./style.css";

type State = {
  vaultPath: string | null;
  notes: string[];
  activePath: string | null;
  activeContent: string;
  events: string[];
  status: string;
};

const state: State = {
  vaultPath: null,
  notes: [],
  activePath: null,
  activeContent: "",
  events: [],
  status: "Choose a folder to exercise native access and file watching.",
};

let stopWatching: (() => void) | null = null;
const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) throw new Error("Missing app root");
const app: HTMLElement = appRoot;

function joinPath(parent: string, child: string): string {
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[\\/]$/, "")}${separator}${child}`;
}

async function collectMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readDir(directory);
  const files = await Promise.all(
    entries.map(async (entry: DirEntry): Promise<string[]> => {
      const path = joinPath(directory, entry.name);
      if (entry.isDirectory) return collectMarkdownFiles(path);
      return entry.isFile && entry.name.toLowerCase().endsWith(".md") ? [path] : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

function relativePath(path: string): string {
  if (!state.vaultPath) return path;
  return path.slice(state.vaultPath.length).replace(/^[\\/]/, "");
}

function describeEvent(event: WatchEvent): string {
  const paths = event.paths.map(relativePath).join(", ");
  return `${new Date().toLocaleTimeString()} · ${JSON.stringify(event.type)} · ${paths}`;
}

async function loadNote(path: string): Promise<void> {
  state.activePath = path;
  state.activeContent = await readTextFile(path);
  state.status = `Read ${relativePath(path)} through the scoped filesystem plugin.`;
  render();
}

async function rescan(): Promise<void> {
  if (!state.vaultPath) return;
  state.notes = await collectMarkdownFiles(state.vaultPath);

  if (state.activePath && !state.notes.includes(state.activePath)) {
    state.activePath = null;
    state.activeContent = "";
  }

  if (!state.activePath && state.notes[0]) await loadNote(state.notes[0]);
  render();
}

async function chooseVault(): Promise<void> {
  const selected = await open({
    directory: true,
    recursive: true,
    fileAccessMode: "scoped",
    multiple: false,
    title: "Choose a Notes Vault",
  });

  if (!selected) return;

  stopWatching?.();
  stopWatching = null;
  state.vaultPath = selected;
  state.activePath = null;
  state.activeContent = "";
  state.events = [];
  state.status = "Folder selected; scanning Markdown files and starting watcher.";
  render();

  await rescan();
  stopWatching = await watch(
    selected,
    async (event) => {
      state.events = [describeEvent(event), ...state.events].slice(0, 8);
      state.status = "External filesystem activity observed; Vault rescanned.";
      await rescan();
    },
    { recursive: true, delayMs: 350 },
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render(): void {
  const noteButtons = state.notes
    .map(
      (path) =>
        `<button class="note ${path === state.activePath ? "active" : ""}" data-note="${escapeHtml(path)}">${escapeHtml(relativePath(path))}</button>`,
    )
    .join("");
  const events = state.events.length
    ? state.events.map((event) => `<li>${escapeHtml(event)}</li>`).join("")
    : "<li>No watcher events yet.</li>";

  app.innerHTML = `
    <header>
      <div>
        <p class="eyebrow">THROWAWAY TAURI 2 PROTOTYPE</p>
        <h1>Native Vault boundary</h1>
        <p class="status">${escapeHtml(state.status)}</p>
      </div>
      <button id="choose-vault" class="primary">Choose Vault</button>
    </header>
    <section class="facts">
      <div><span>Selected folder</span><strong>${escapeHtml(state.vaultPath ?? "None")}</strong></div>
      <div><span>Markdown files</span><strong>${state.notes.length}</strong></div>
      <div><span>Watcher</span><strong>${stopWatching ? "Running" : "Stopped"}</strong></div>
    </section>
    <section class="workspace">
      <aside>
        <h2>Vault files</h2>
        <div class="notes">${noteButtons || "<p class=\"empty\">No Markdown files found.</p>"}</div>
      </aside>
      <article>
        <h2>${escapeHtml(state.activePath ? relativePath(state.activePath) : "No note selected")}</h2>
        <pre>${escapeHtml(state.activeContent || "Choose a Vault containing a Markdown file.")}</pre>
      </article>
    </section>
    <section class="events">
      <h2>Recent filesystem events</h2>
      <ol>${events}</ol>
    </section>
  `;

  document.querySelector<HTMLButtonElement>("#choose-vault")?.addEventListener("click", () => {
    chooseVault().catch(showError);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.note;
      if (path) loadNote(path).catch(showError);
    });
  });
}

function showError(error: unknown): void {
  state.status = `Error: ${error instanceof Error ? error.message : String(error)}`;
  render();
}

window.addEventListener("beforeunload", () => stopWatching?.());
render();
