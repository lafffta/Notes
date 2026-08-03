# Store imported Attachments in the Vault

New external files are copied into a Vault-root `.attachments/` directory and linked from Notes with ordinary relative Markdown paths; existing Vault-local files remain valid Attachments wherever the user placed them. Keeping imported files in the user-owned Vault preserves portability and shared use without scattering Note-specific sidecar directories or creating an app-owned file store, while the relative links keep Notes usable outside the application.
