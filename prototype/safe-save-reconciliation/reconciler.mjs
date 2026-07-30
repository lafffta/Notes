// Portable prototype logic: no filesystem, terminal, or clock access belongs here.

export function createDocumentState({ noteId, path, content, hash }) {
  return {
    noteId,
    activePath: path,
    baselineHash: hash,
    buffer: content,
    dirty: false,
    status: "in-sync",
    pendingWatcherEvents: [],
    duplicatePaths: [],
    conflict: null,
    recoveryArtifacts: [],
    lastTransition: "Opened Note from disk",
  };
}

export function reduceDocument(state, action) {
  switch (action.type) {
    case "LOCAL_EDIT":
      return withTransition(
        {
          ...state,
          buffer: action.content,
          dirty: true,
          status: state.conflict ? state.status : "local-dirty",
        },
        "Changed the local buffer",
      );

    case "WATCH_EVENT":
      return {
        ...state,
        pendingWatcherEvents: [
          ...state.pendingWatcherEvents,
          { eventType: action.eventType, filename: action.filename ?? "(unknown)" },
        ].slice(-12),
        lastTransition: "Queued watcher invalidation; no document decision made yet",
      };

    case "RECONCILE_SCAN":
      return reconcileScan(state, action.files);

    case "SAVE_BLOCKED":
      return withTransition(
        {
          ...state,
          status: action.reason === "missing" ? "deleted-with-local-edits" : "content-conflict",
          conflict: {
            kind: action.reason,
            diskPath: action.diskPath ?? state.activePath,
            diskHash: action.diskHash ?? null,
            diskContent: action.diskContent ?? null,
          },
        },
        "Blocked autosave because the expected disk version no longer matches",
      );

    case "SAVE_SUCCEEDED":
      return withTransition(
        {
          ...state,
          activePath: action.path,
          baselineHash: action.hash,
          buffer: action.content,
          dirty: false,
          status: "in-sync",
          pendingWatcherEvents: [],
          duplicatePaths: [],
          conflict: null,
        },
        "Committed an atomic save against the expected disk version",
      );

    case "ACCEPT_DISK":
      return withTransition(
        {
          ...state,
          activePath: action.path,
          baselineHash: action.hash,
          buffer: action.content,
          dirty: false,
          status: "in-sync",
          pendingWatcherEvents: [],
          conflict: null,
        },
        "Accepted the external disk version and discarded local edits",
      );

    case "ACCEPT_DELETION":
      return withTransition(
        {
          ...state,
          baselineHash: null,
          buffer: "",
          dirty: false,
          status: "closed-after-external-delete",
          pendingWatcherEvents: [],
          conflict: null,
        },
        "Accepted the external deletion and closed the Note",
      );

    case "PRESERVE_LOCAL_COPY":
      return withTransition(
        {
          ...state,
          activePath: action.disk.path,
          baselineHash: action.disk.hash,
          buffer: action.disk.content,
          dirty: false,
          status: "in-sync",
          pendingWatcherEvents: [],
          conflict: null,
          recoveryArtifacts: [
            ...state.recoveryArtifacts,
            { path: action.recoveryPath, noteId: action.recoveryNoteId },
          ],
        },
        "Preserved local edits as a new recovered Note, then accepted the disk version",
      );

    case "DUPLICATE_REIDENTIFIED":
      return withTransition(
        {
          ...state,
          duplicatePaths: [],
          status: state.dirty ? "local-dirty" : "in-sync",
          pendingWatcherEvents: [],
        },
        `Assigned a fresh Note ID to ${action.path}`,
      );

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function canAttemptAutosave(state) {
  return (
    state.dirty &&
    !state.conflict &&
    state.duplicatePaths.length === 0 &&
    ["local-dirty", "local-dirty-after-rename"].includes(state.status)
  );
}

function reconcileScan(state, files) {
  const candidates = files.filter((file) => file.noteId === state.noteId);
  const cleared = { ...state, pendingWatcherEvents: [] };

  if (candidates.length === 0) {
    return withTransition(
      {
        ...cleared,
        status: state.dirty ? "deleted-with-local-edits" : "deleted-externally",
        conflict: state.dirty
          ? { kind: "missing", diskPath: state.activePath, diskHash: null, diskContent: null }
          : null,
      },
      state.dirty
        ? "Found the file missing while local edits still exist"
        : "Found the clean Note deleted externally; cached content remains readable",
    );
  }

  if (candidates.length > 1) {
    return withTransition(
      {
        ...cleared,
        status: "duplicate-id-conflict",
        duplicatePaths: candidates.map((candidate) => candidate.path),
        conflict: { kind: "duplicate-id", candidates },
      },
      "Found multiple files claiming the same Note ID; automatic saves are blocked",
    );
  }

  const [disk] = candidates;
  const pathChanged = disk.path !== state.activePath;
  const contentChanged = disk.hash !== state.baselineHash;

  if (!state.dirty) {
    return withTransition(
      {
        ...cleared,
        activePath: disk.path,
        baselineHash: disk.hash,
        buffer: disk.content,
        status: pathChanged
          ? "followed-external-rename"
          : contentChanged
            ? "reloaded-external-change"
            : "in-sync",
        duplicatePaths: [],
        conflict: null,
      },
      pathChanged
        ? "Followed the stable Note ID to its externally renamed path"
        : contentChanged
          ? "Reloaded the clean buffer from the external disk version"
          : "Reconciled watcher noise; disk and buffer already agree",
    );
  }

  if (!contentChanged) {
    return withTransition(
      {
        ...cleared,
        activePath: disk.path,
        status: pathChanged ? "local-dirty-after-rename" : "local-dirty",
        duplicatePaths: [],
        conflict: null,
      },
      pathChanged
        ? "Followed an external rename while preserving unsaved local edits"
        : "Preserved unsaved local edits because the disk version is unchanged",
    );
  }

  return withTransition(
    {
      ...cleared,
      activePath: disk.path,
      status: "content-conflict",
      duplicatePaths: [],
      conflict: {
        kind: "content-changed",
        diskPath: disk.path,
        diskHash: disk.hash,
        diskContent: disk.content,
      },
    },
    "Detected divergent local and external content; automatic saves are blocked",
  );
}

function withTransition(state, lastTransition) {
  return { ...state, lastTransition };
}
