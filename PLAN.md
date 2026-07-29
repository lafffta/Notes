# Desktop Notes Application — Initial Wayfinder Plan

## Destination

Produce a build-ready specification for a local-first desktop notes application where:

- Notes are ordinary Markdown files owned by the user.
- Inline and display LaTeX formulas render correctly.
- Notes remain readable and editable outside the application.
- Search, navigation, autosave, and external file changes behave predictably.
- The first release runs on Windows and macOS from one codebase.

## Product promise

**A fast desktop workspace for writing Markdown and mathematical notes without locking the user’s content into a proprietary database.**

The application should feel closer to a focused text editor than a document-management platform.

## Recommended product assumptions

These assumptions keep the first release small enough to complete:

1. It is a single-user, offline-first application.
2. A user selects a folder called a **vault**.
3. Markdown files are the source of truth.
4. The application initially provides source editing with an adjacent or toggleable preview.
5. Cloud sync, collaboration, plugins, mobile clients, and end-to-end encryption are outside the first release.
6. Users may sync the vault through Git, Dropbox, OneDrive, iCloud, Syncthing, or another external tool, but the application does not own that synchronization.

## Recommended technical architecture

### Desktop shell: Tauri 2

Use:

- Tauri 2
- React
- TypeScript
- Vite
- Rust for filesystem and indexing operations

Tauri supports web frontends while using each operating system’s native webview rather than bundling Chromium. Its frontend communicates with Rust through explicit commands and events. That gives this application a relatively small desktop package and a clear privilege boundary around filesystem access.

Electron remains the fallback if development speed proves substantially more important than package size or the Rust boundary. Electron bundles Chromium and Node.js and uses separate main and renderer processes, with privileged functionality exposed through controlled IPC.

**Recommendation:** begin with Tauri. Reconsider only after a short filesystem-and-editor prototype exposes a concrete blocker.

### Editor: CodeMirror 6

Use CodeMirror 6 as a Markdown source editor because it provides composable editing extensions and an official Markdown language package.

The initial editor should support:

- Markdown syntax highlighting
- Bracket and delimiter matching
- Search and replace
- Multiple cursors
- Undo and redo
- Line wrapping
- Keyboard shortcuts
- Automatic continuation of lists
- Optional Vim bindings later

Do not begin with a WYSIWYG or Obsidian-style live-preview editor. Hiding Markdown delimiters while maintaining cursor positions, selections, undo history, pasted content, and embedded math substantially increases editor complexity.

### Markdown and mathematics

Recommended rendering pipeline:

```text
Markdown
  → remark-parse
  → remark-gfm
  → remark-math
  → remark-rehype
  → rehype-katex
  → rehype-sanitize
  → HTML preview
```

`remark-math` supports mathematical syntax in Markdown and can pass it to KaTeX through `rehype-katex`. KaTeX supports browser rendering, inline and display modes, and graceful rendering of invalid formulas when configured not to throw.

Supported syntax:

```markdown
Euler's identity is $e^{i\pi} + 1 = 0$.

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
```

Raw HTML should be disabled initially. If enabled later, sanitize it before inserting it into the preview.

### Storage model

Use a user-selected directory:

```text
My Notes/
├── Calculus/
│   └── integration-by-parts.md
├── Physics/
│   └── harmonic-oscillator.md
├── .attachments/
│   └── diagram-01.png
└── .notes/
    └── settings.json
```

Each note is a normal Markdown file. Optional YAML frontmatter stores application metadata:

```yaml
---
id: 01JZQ8QAMX3V21A37D5QWAGQ0N
title: Harmonic Oscillator
created: 2026-07-26T23:15:00-06:00
updated: 2026-07-26T23:42:00-06:00
tags:
  - physics
  - differential-equations
---
```

The stable `id` lets filenames and titles change without breaking internal application identity.

Use safe writes:

1. Write the complete note to a temporary file.
2. Flush it.
3. Rename the temporary file over the destination.
4. Update the search index only after the write succeeds.

### Search index

Store searchable metadata in an application-owned SQLite database, not inside the vault. The database is a disposable derived index; deleting it must never delete notes.

Suggested tables:

```text
notes
- id
- vault_id
- relative_path
- title
- modified_at
- content_hash

notes_fts
- note_id
- title
- body
- tags
```

SQLite FTS5 provides full-text indexing, matching, and relevance ranking for document collections. Tauri also provides an official SQL plugin with SQLite support.

The application should rebuild the index when:

- A vault is first opened.
- The index schema changes.
- A Markdown file changes outside the application.
- Stored hashes no longer match file contents.

### Filesystem boundary

Keep privileged filesystem operations behind a small Rust interface:

```text
VaultService
- openVault(path)
- scanVault()
- watchVault()
- rebuildIndex()

NoteRepository
- createNote(input)
- readNote(noteId)
- saveNote(noteId, content, expectedVersion)
- renameNote(noteId, newPath)
- moveNote(noteId, destination)
- trashNote(noteId)

SearchService
- indexNote(note)
- removeNote(noteId)
- search(query)

AttachmentService
- importAttachment(source)
- resolveAttachment(path)
```

Tauri supports explicit command-based IPC and fine-grained capabilities for controlling which windows may access filesystem and other privileged commands. Its official plugins include filesystem access, native directory dialogs, persisted access scopes, SQL, and window-state restoration.

The React UI should not directly scatter filesystem calls throughout components.

## Domain model

### Vault

A directory selected by the user that contains notes and attachments.

### Note

A Markdown document with stable identity, filesystem location, content, metadata, and modification version.

### Note reference

A link from one note to another. This should eventually resolve by stable note identity rather than filename alone.

### Attachment

A non-Markdown asset owned by the vault and referenced through a relative path.

### Workspace

Transient interface state: active vault, selected note, open panes, sidebar width, editor mode, and search query.

### Search index

A rebuildable projection of vault contents. It is never authoritative.

## MVP user experience

The main window uses three areas:

```text
┌──────────────┬────────────────────┬────────────────────┐
│ Vault tree   │ Markdown editor    │ Rendered preview   │
│ and search   │                    │                    │
│              │                    │                    │
└──────────────┴────────────────────┴────────────────────┘
```

Required workflows:

1. Create or open a vault.
2. Create a note.
3. Edit and autosave it.
4. Rename or move it.
5. Render standard Markdown.
6. Render inline and display LaTeX.
7. Search titles, text, and tags.
8. Detect externally created, modified, renamed, and deleted files.
9. Insert an image attachment.
10. Restore the previous vault, selected note, and window layout.

## Reliability rules

- Never require the index database to open a note.
- Never overwrite a newer external version silently.
- Track a content hash or modification version when a note is loaded.
- When saving against a changed version, show a comparison or create a conflict copy.
- Preserve line endings where practical.
- Treat malformed frontmatter as recoverable.
- Display invalid LaTeX without losing its source.
- Send deleted notes to the operating system trash or a vault-local trash folder rather than permanently deleting immediately.
- Make full-index rebuilds cancellable and safe to repeat.

## Initial Wayfinder decision tickets

### 1. Define the editing experience

**Type:** Prototype

Decide among:

- Editor and preview side by side
- Editor with a preview toggle
- Preview only when the cursor leaves a math expression
- Full live preview

**Recommended answer:** side-by-side and toggle modes for the MVP. Prototype this before producing the final specification.

### 2. Define note identity and filenames

**Type:** Grilling

Questions:

- Does the first heading become the title?
- Does changing the title rename the file?
- Are duplicate titles allowed?
- Are user-created folders preserved exactly?
- Is frontmatter mandatory or added only when necessary?

**Recommended answer:** allow duplicate titles, keep path and title separate, preserve user folders, and assign stable IDs through frontmatter.

### 3. Define internal links

**Type:** Grilling plus prototype

Candidate syntax:

```markdown
[[Harmonic Oscillator]]
[[note-id|Harmonic Oscillator]]
[Harmonic Oscillator](../Physics/harmonic-oscillator.md)
```

**Recommended answer:** render ordinary Markdown links first. Add wiki links and backlinks after the storage and rename semantics are proven.

### 4. Define external-change and conflict behaviour

**Type:** Prototype

Test:

- Editing the same note in another program
- Renaming a note externally
- External sync creating duplicate files
- Deleting the active file
- Receiving several watcher events for one write

**Recommended answer:** automatically reload clean documents; prompt or create a conflict copy when unsaved local edits exist.

### 5. Define target platforms and distribution

**Type:** Grilling

Decide:

- Windows and macOS together, or one first
- Code signing and notarization
- Automatic updates
- Linux support
- Microsoft Store or Mac App Store distribution

**Recommended answer:** develop on the primary platform, continuously build Windows and macOS in CI, distribute signed downloads outside app stores, and defer automatic updates until the storage model is stable.

### 6. Define the sync boundary

**Type:** Grilling

**Recommended answer:** external folder sync is supported but not managed. Native sync accounts, a server, collaboration, and merge synchronization remain outside the initial destination.

## Delivery sequence

### Phase 0 — Risk prototypes

Build throwaway prototypes for:

- CodeMirror editing plus KaTeX preview
- Opening and watching a user-selected directory
- Atomic save and external-change detection
- Packaging a minimal application on Windows and macOS

Keep the answers; discard prototype architecture that does not deserve production support.

### Phase 1 — Tracer-bullet application

Deliver one narrow end-to-end path:

```text
Open vault
→ select Markdown file
→ edit
→ save through Rust
→ render Markdown and math
→ reopen with content intact
```

This validates every major system boundary before broad feature development.

### Phase 2 — Core note management

Add:

- Note creation
- Rename and move
- Folder tree
- Autosave
- Attachments
- Recently opened notes
- Keyboard command system

### Phase 3 — Search and resilience

Add:

- SQLite FTS5 index
- Search ranking and snippets
- Filesystem watcher reconciliation
- Conflict handling
- Index rebuilding
- Recovery from malformed notes and interrupted writes

### Phase 4 — Product finishing

Add:

- Preferences
- Theme support
- Window-state restoration
- Accessibility review
- Installer creation
- Signing and notarization
- Crash reporting only if explicitly opted into

## Testing strategy

### Rust

Test the storage modules against temporary directories:

- Atomic writes
- Rename and move
- Path validation
- External modification detection
- Index reconciliation
- Conflict creation

### TypeScript

Test:

- Markdown parsing
- Math rendering
- Invalid LaTeX
- Link extraction
- Frontmatter parsing
- State transitions
- Search result presentation

### End-to-end

Maintain a small fixture vault containing:

- Nested folders
- Unicode filenames
- Long notes
- Inline and display math
- Images
- Broken frontmatter
- Conflicting filenames
- External modifications

The most important acceptance test is that notes remain intact and readable after the index and all application configuration are deleted.

## Explicitly outside the MVP

- Proprietary cloud synchronization
- User accounts
- Real-time collaboration
- Mobile applications
- Plugin marketplace
- Graph visualization
- AI writing features
- End-to-end encrypted sync
- Full WYSIWYG editing
- Web publishing
- Multiple simultaneous windows

## Suggested repository structure

```text
Notes/
├── src/
│   ├── app/
│   ├── editor/
│   ├── markdown/
│   ├── notes/
│   ├── search/
│   └── workspace/
├── src-tauri/
│   ├── src/
│   │   ├── vault/
│   │   ├── notes/
│   │   ├── search/
│   │   ├── attachments/
│   │   └── commands/
│   └── capabilities/
├── tests/
│   └── fixtures/
│       └── example-vault/
├── docs/
│   ├── product-spec.md
│   └── adr/
├── CONTEXT.md
└── README.md
```

## Definition of a successful first release

The release is successful when a user can install the application, choose a folder, write Markdown containing LaTeX, find the note later, edit the same files with another program, and leave the application without needing an export process.
