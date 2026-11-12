# Security Policy

## Supported versions

Only the latest release of Claude Arena gets fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately
through GitHub: **Security → Report a vulnerability** on this repository.

Claude Arena runs as a Claude Code hooks module in the engine's sandbox: it has
no file system, network or process access of its own and stores only its
arena state and stats. Reports about a way to break out of that, or to make
the arena hold up or alter a tool call, are especially welcome.
