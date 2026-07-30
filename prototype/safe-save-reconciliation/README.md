# Safe-save and external-change reconciliation prototype

This throwaway prototype asks whether one reconciliation model can safely handle atomic saves, noisy filesystem watcher events, clean and dirty buffers, external edits, renames and deletes, and duplicate Note IDs created by sync tools.

It uses a real scratch Vault at `.scratch-vault/`. The directory is deleted and recreated by the prototype and must never contain real Notes.

Run the interactive terminal prototype:

```powershell
node prototype/safe-save-reconciliation/index.mjs
```

Run the deterministic scenario tour:

```powershell
node prototype/safe-save-reconciliation/index.mjs --demo
```

The reducer in `reconciler.mjs` is pure. Filesystem access, watcher events, keyboard input, and rendering live only in the throwaway shell.
