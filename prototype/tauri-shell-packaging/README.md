# Tauri shell packaging prototype

> **THROWAWAY PROTOTYPE — do not treat this as production architecture.**

## Question

Can the Notes MVP use one Tauri 2 codebase to let a user choose a Vault, recursively read its Markdown files, observe filesystem changes, and produce installable Windows and macOS packages? The prototype exists only to expose concrete platform, permission, signing, and packaging constraints.

## Run

Prerequisites are the Tauri 2 platform dependencies, Rust, Node.js, and npm.

```powershell
npm install
npm run tauri dev
```

Choose a folder containing Markdown files. The screen shows the selected path, discovered notes, the active note, and the most recent debounced filesystem watcher events. Edit, create, rename, or delete a Markdown file in another program to exercise the watch path.

## Build

```powershell
npm run tauri build
```

The `tauri-shell-packaging.yml` workflow builds a Windows NSIS installer plus macOS DMGs for Apple Silicon and Intel. These prototype packages are not production-signed or notarized.
