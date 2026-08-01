# Desktop Notes

This context describes the user-owned notes workspace and the application concepts that surround it.

## Language

**Vault**:
A user-selected directory whose Markdown notes and attachments remain owned by the user and usable outside the application.
_Avoid_: Workspace, library, repository

**Note**:
A Markdown document stored in a Vault and treated as authoritative user content.
_Avoid_: Record, database entry

**Note ID**:
An opaque, stable identity belonging to a Note that remains unchanged when its title or location changes.
_Avoid_: File path, filename

**Note Title**:
The human-facing name of a Note, independent of its filename and folder location.
_Avoid_: Filename, path

**Search Index**:
A disposable, rebuildable representation of Vault contents used to find Notes. It is never authoritative.
_Avoid_: Note store, database of record

**Search Surface**:
The unified interface for finding Notes by title, tag, or body and for discovering recent Notes and tags when no query is present.
_Avoid_: Search box, command palette

**Workspace State**:
Transient application state associated with using a Vault, such as the selected Note or window layout. It is not user-authored note content.
_Avoid_: Vault
