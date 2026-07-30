import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canAttemptAutosave,
  createDocumentState,
  reduceDocument,
} from "./reconciler.mjs";

const prototypeDir = dirname(fileURLToPath(import.meta.url));
const scratchVault = join(prototypeDir, ".scratch-vault");
const originalName = "harmonic-oscillator.md";
const originalPath = join(scratchVault, originalName);
const noteId = "01K0SAFEWRITE7V5K7T9N1";
const initialContent = `---\nid: ${noteId}\ntitle: Harmonic Oscillator\n---\n\n# Harmonic Oscillator\n\nInitial disk version.\n`;

let state;
let watcher;
let actionQueue = Promise.resolve();
let watcherWaiters = [];
const demoMode = process.argv.includes("--demo");

await resetScratchVault();
state = createDocumentState({
  noteId,
  path: originalPath,
  content: initialContent,
  hash: hashContent(initialContent),
});

watcher = watch(scratchVault, (eventType, filename) => {
  state = reduceDocument(state, {
    type: "WATCH_EVENT",
    eventType,
    filename: filename?.toString(),
  });
  const waiters = watcherWaiters;
  watcherWaiters = [];
  for (const resolve of waiters) resolve();
  if (!demoMode) render();
});

if (demoMode) {
  await runDemo();
  watcher.close();
  process.exit(0);
}

process.stdin.setEncoding("utf8");
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (input) => {
  for (const key of input) {
    actionQueue = actionQueue.then(() => handleKey(key)).catch((error) => {
      state = { ...state, lastTransition: `Prototype error: ${error.message}` };
      render();
    });
  }
});

process.on("SIGINT", quit);
render();

async function handleKey(key) {
  switch (key.toLowerCase()) {
    case "l":
      state = reduceDocument(state, {
        type: "LOCAL_EDIT",
        content: `${state.buffer.trimEnd()}\n\nLocal unsaved edit ${Date.now()}.\n`,
      });
      break;
    case "s":
      await attemptAutosave();
      break;
    case "e":
      await simulateExternalEdit();
      break;
    case "r":
      await simulateExternalRename();
      break;
    case "d":
      await simulateExternalDelete();
      break;
    case "c":
      await simulateSyncDuplicate();
      break;
    case "w":
      await reconcileFromDisk();
      break;
    case "a":
      await acceptExternalOutcome();
      break;
    case "k":
      await keepLocalOutcome();
      break;
    case "p":
      await preserveLocalCopy();
      break;
    case "u":
      await reidentifyDuplicate();
      break;
    case "n":
      await resetScratchVault();
      state = createDocumentState({
        noteId,
        path: originalPath,
        content: initialContent,
        hash: hashContent(initialContent),
      });
      break;
    case "q":
    case "\u0003":
      quit();
      return;
    default:
      state = { ...state, lastTransition: `Ignored key ${JSON.stringify(key)}` };
  }
  render();
}

async function attemptAutosave() {
  if (!canAttemptAutosave(state)) {
    state = { ...state, lastTransition: `Autosave not allowed while status is ${state.status}` };
    return;
  }

  const disk = await readDiskCandidate(state.activePath);
  if (!disk) {
    state = reduceDocument(state, { type: "SAVE_BLOCKED", reason: "missing" });
    return;
  }
  if (disk.hash !== state.baselineHash) {
    state = reduceDocument(state, {
      type: "SAVE_BLOCKED",
      reason: "content-changed",
      diskPath: disk.path,
      diskHash: disk.hash,
      diskContent: disk.content,
    });
    return;
  }

  await atomicWrite(state.activePath, state.buffer);
  state = reduceDocument(state, {
    type: "SAVE_SUCCEEDED",
    path: state.activePath,
    content: state.buffer,
    hash: hashContent(state.buffer),
  });
}

async function reconcileFromDisk() {
  state = reduceDocument(state, { type: "RECONCILE_SCAN", files: await scanVault() });
}

async function simulateExternalEdit() {
  const disk = await readDiskCandidate(state.activePath);
  if (!disk) {
    state = { ...state, lastTransition: "External editor found no file to edit" };
    return;
  }
  await writeFile(disk.path, `${disk.content.trimEnd()}\n\nExternal edit ${Date.now()}.\n`, "utf8");
  state = { ...state, lastTransition: "External editor changed the file; press [w] to reconcile watcher noise" };
}

async function simulateExternalRename() {
  const disk = await readDiskCandidate(state.activePath);
  if (!disk) {
    state = { ...state, lastTransition: "External rename found no active file" };
    return;
  }
  const renamedPath = join(scratchVault, "harmonic-oscillator-renamed.md");
  await rm(renamedPath, { force: true });
  await rename(disk.path, renamedPath);
  state = { ...state, lastTransition: "External tool renamed the file; press [w] to reconcile by Note ID" };
}

async function simulateExternalDelete() {
  await rm(state.activePath, { force: true });
  state = { ...state, lastTransition: "External tool deleted the file; press [w] to reconcile" };
}

async function simulateSyncDuplicate() {
  const disk = await readDiskCandidate(state.activePath);
  if (!disk) {
    state = { ...state, lastTransition: "Sync tool found no file to duplicate" };
    return;
  }
  const duplicatePath = join(scratchVault, "harmonic-oscillator-sync-conflict.md");
  await writeFile(duplicatePath, disk.content, "utf8");
  state = { ...state, lastTransition: "Sync tool copied the file with the same Note ID; press [w] to reconcile" };
}

async function acceptExternalOutcome() {
  if (state.status === "deleted-externally" || state.status === "deleted-with-local-edits") {
    state = reduceDocument(state, { type: "ACCEPT_DELETION" });
    return;
  }
  if (!state.conflict?.diskContent) {
    state = { ...state, lastTransition: "There is no external content to accept" };
    return;
  }
  state = reduceDocument(state, {
    type: "ACCEPT_DISK",
    path: state.conflict.diskPath,
    hash: state.conflict.diskHash,
    content: state.conflict.diskContent,
  });
}

async function keepLocalOutcome() {
  if (!["content-conflict", "deleted-with-local-edits"].includes(state.status)) {
    state = { ...state, lastTransition: "There is no local conflict outcome to keep" };
    return;
  }
  const destination = state.conflict?.diskPath ?? state.activePath;
  await atomicWrite(destination, state.buffer);
  state = reduceDocument(state, {
    type: "SAVE_SUCCEEDED",
    path: destination,
    content: state.buffer,
    hash: hashContent(state.buffer),
  });
  state = { ...state, lastTransition: "Explicitly replaced or restored the disk file with local content" };
}

async function preserveLocalCopy() {
  if (!["content-conflict", "deleted-with-local-edits"].includes(state.status)) {
    state = { ...state, lastTransition: "There are no conflicted local edits to preserve" };
    return;
  }
  const recoveryNoteId = `RECOVERED-${Date.now()}`;
  const recoveryPath = join(scratchVault, "harmonic-oscillator-recovered.md");
  const recoveryContent = replaceNoteId(state.buffer, recoveryNoteId);
  await atomicWrite(recoveryPath, recoveryContent);

  const disk = state.conflict?.diskContent
    ? {
        path: state.conflict.diskPath,
        hash: state.conflict.diskHash,
        content: state.conflict.diskContent,
      }
    : {
        path: state.activePath,
        hash: hashContent(initialContent),
        content: initialContent,
      };

  state = reduceDocument(state, {
    type: "PRESERVE_LOCAL_COPY",
    disk,
    recoveryPath,
    recoveryNoteId,
  });
}

async function reidentifyDuplicate() {
  if (state.status !== "duplicate-id-conflict" || state.duplicatePaths.length < 2) {
    state = { ...state, lastTransition: "There is no duplicate Note ID to repair" };
    return;
  }
  const duplicatePath = state.duplicatePaths.find((path) => path !== state.activePath) ?? state.duplicatePaths.at(-1);
  const content = await readFile(duplicatePath, "utf8");
  const freshId = `DUPLICATE-${Date.now()}`;
  await atomicWrite(duplicatePath, replaceNoteId(content, freshId));
  state = reduceDocument(state, { type: "DUPLICATE_REIDENTIFIED", path: duplicatePath });
  await reconcileFromDisk();
}

async function resetScratchVault() {
  if (watcher) {
    const entries = await readdir(scratchVault, { withFileTypes: true });
    for (const entry of entries) {
      await rm(join(scratchVault, entry.name), { recursive: entry.isDirectory(), force: true });
    }
  } else {
    await rm(scratchVault, { recursive: true, force: true });
  }
  await mkdir(scratchVault, { recursive: true });
  await atomicWrite(originalPath, initialContent);
}

async function atomicWrite(path, content) {
  const temporaryPath = join(dirname(path), `.${basename(path)}.PROTOTYPE-TEMP`);
  const handle = await open(temporaryPath, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);
}

async function scanVault() {
  const entries = await readdir(scratchVault, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
    const path = join(scratchVault, entry.name);
    const content = await readFile(path, "utf8");
    files.push({ path, content, hash: hashContent(content), noteId: extractNoteId(content) });
  }
  return files;
}

async function readDiskCandidate(path) {
  try {
    const content = await readFile(path, "utf8");
    return { path, content, hash: hashContent(content), noteId: extractNoteId(content) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function extractNoteId(content) {
  return content.match(/^---\r?\n[\s\S]*?^id:\s*([^\r\n]+)$/m)?.[1]?.trim() ?? null;
}

function replaceNoteId(content, replacement) {
  return content.replace(/^(id:\s*).+$/m, `$1${replacement}`);
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function render() {
  console.clear();
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";
  console.log(`${bold}PROTOTYPE — Safe save and reconciliation${reset}`);
  console.log(`${dim}${scratchVault}${reset}\n`);
  console.log(`${bold}status${reset}:        ${state.status}`);
  console.log(`${bold}noteId${reset}:        ${state.noteId}`);
  console.log(`${bold}activePath${reset}:    ${basename(state.activePath)}`);
  console.log(`${bold}baselineHash${reset}:  ${state.baselineHash ?? "(none)"}`);
  console.log(`${bold}bufferHash${reset}:    ${state.buffer ? hashContent(state.buffer) : "(closed)"}`);
  console.log(`${bold}dirty${reset}:         ${state.dirty}`);
  console.log(`${bold}autosave${reset}:      ${canAttemptAutosave(state) ? "eligible" : "blocked"}`);
  console.log(`${bold}watcherEvents${reset}: ${state.pendingWatcherEvents.length}`);
  console.log(`${bold}duplicates${reset}:    ${state.duplicatePaths.map((path) => basename(path)).join(", ") || "(none)"}`);
  console.log(`${bold}conflict${reset}:      ${state.conflict?.kind ?? "(none)"}`);
  console.log(`${bold}recovered${reset}:     ${state.recoveryArtifacts.map((item) => basename(item.path)).join(", ") || "(none)"}`);
  console.log(`\n${bold}Last transition${reset}\n${state.lastTransition}`);
  console.log(`\n${bold}Actions${reset}`);
  console.log("[l] local edit   [s] autosave     [e] external edit   [r] external rename");
  console.log("[d] external delete  [c] sync duplicate  [w] reconcile watcher burst");
  console.log("[a] accept external  [k] keep/restore local  [p] preserve local copy");
  console.log("[u] re-ID duplicate  [n] reset scratch Vault  [q] quit");
}

async function runDemo() {
  const snapshots = [];
  const capture = (label, observedWatcherEvents = state.pendingWatcherEvents.length) => snapshots.push({
    label,
    status: state.status,
    dirty: state.dirty,
    activePath: basename(state.activePath),
    baselineHash: state.baselineHash,
    bufferHash: state.buffer ? hashContent(state.buffer) : null,
    conflict: state.conflict?.kind ?? null,
    duplicates: state.duplicatePaths.map((path) => basename(path)),
    observedWatcherEvents,
    transition: state.lastTransition,
  });

  capture("opened");
  await simulateExternalEdit();
  await waitForWatcherEvent();
  const cleanEditEvents = state.pendingWatcherEvents.length;
  await reconcileFromDisk();
  capture("clean external edit auto-reloads", cleanEditEvents);

  state = reduceDocument(state, {
    type: "LOCAL_EDIT",
    content: `${state.buffer}\nLocal unsaved demo edit.\n`,
  });
  await simulateExternalEdit();
  await waitForWatcherEvent();
  const saveRaceEvents = state.pendingWatcherEvents.length;
  await attemptAutosave();
  capture("expected-version check blocks save before watcher reconciliation", saveRaceEvents);

  await preserveLocalCopy();
  capture("local edits preserved as recovered Note");

  state = reduceDocument(state, {
    type: "LOCAL_EDIT",
    content: `${state.buffer}\nLocal edit survives rename.\n`,
  });
  await simulateExternalRename();
  await waitForWatcherEvent();
  const renameEvents = state.pendingWatcherEvents.length;
  await reconcileFromDisk();
  capture("dirty external rename follows Note ID and preserves buffer", renameEvents);
  await attemptAutosave();
  capture("autosave succeeds at externally renamed path");

  await simulateExternalDelete();
  await waitForWatcherEvent();
  const cleanDeleteEvents = state.pendingWatcherEvents.length;
  await reconcileFromDisk();
  capture("clean external delete keeps readable cached content", cleanDeleteEvents);
  await acceptExternalOutcome();
  capture("user accepts clean external deletion");

  await resetScratchVault();
  state = createDocumentState({
    noteId,
    path: originalPath,
    content: initialContent,
    hash: hashContent(initialContent),
  });
  await waitForWatcherEvent();
  await reconcileFromDisk();
  state = reduceDocument(state, {
    type: "LOCAL_EDIT",
    content: `${state.buffer}\nUnsaved content before delete.\n`,
  });
  await simulateExternalDelete();
  await waitForWatcherEvent();
  const dirtyDeleteEvents = state.pendingWatcherEvents.length;
  await reconcileFromDisk();
  capture("dirty external delete preserves local buffer and blocks autosave", dirtyDeleteEvents);
  await keepLocalOutcome();
  capture("explicit keep restores deleted file atomically");

  await simulateSyncDuplicate();
  await waitForWatcherEvent();
  const duplicateEvents = state.pendingWatcherEvents.length;
  await reconcileFromDisk();
  capture("sync duplicate blocks on duplicate Note ID", duplicateEvents);
  await reidentifyDuplicate();
  capture("explicit re-ID makes the sync copy independent");

  console.log(JSON.stringify(snapshots, null, 2));
}

function waitForWatcherEvent(timeoutMs = 1500) {
  if (state.pendingWatcherEvents.length > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      watcherWaiters = watcherWaiters.filter((waiter) => waiter !== onEvent);
      reject(new Error("Timed out waiting for a filesystem watcher event"));
    }, timeoutMs);
    watcherWaiters.push(onEvent);
  });
}

function quit() {
  watcher?.close();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  console.log("\nPrototype stopped. Scratch data remains under .scratch-vault and is safe to wipe.");
  process.exit(0);
}
