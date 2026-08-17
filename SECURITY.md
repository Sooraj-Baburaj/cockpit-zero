# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's [private vulnerability reporting][report] — Security → Advisories →
**Report a vulnerability** on this repository. If that's unavailable, email
**soorajb123456@gmail.com** with `SECURITY` in the subject.

[report]: https://github.com/Sooraj-Baburaj/cockpit-zero/security/advisories/new

Please include:

- What the issue is and which component it affects (desktop main/renderer, backend, web, shared).
- Steps to reproduce, or a proof of concept.
- Your assessment of the impact.
- The version / commit you tested.

You'll get an acknowledgement within **72 hours** and an assessment within **7 days**. Please give a
reasonable window to ship a fix before public disclosure. Credit is given for valid reports unless
you'd rather stay anonymous.

## Supported versions

CockpitZero is pre-1.0 and has not yet shipped signed release builds. Security fixes land on the
default branch. Once signed releases exist, this section will pin supported versions.

## Scope

In scope — the things this project actually promises:

- **Secret exposure.** Anything that leaks an API key, session token or OAuth token out of the
  OS-keychain-backed vault: into `config.json`, into the renderer, into logs, over the IPC bridge, or
  into a sync payload.
- **Sandbox / isolation escape.** Anything that lets renderer-side content reach Node APIs, the
  filesystem, or `ipcRenderer` directly.
- **Unvalidated IPC.** A main-process handler that acts on renderer input without schema validation.
- **Command injection.** Via action targets, `run-command` arguments, or the shelled-out system
  search (`mdfind`, PowerShell, `plocate`).
- **Prompt injection with real consequences.** Content from a file, email, or connected integration
  that causes the agent to invoke a tool the user never granted, or to bypass the review gate on a
  side-effecting tool.
- **Backend auth flaws.** Session handling, the desktop one-time-code handoff, cross-user data access
  in `/sync`, `/memory`, `/knowledge`, `/integrations`, or `/inference`.
- **Path traversal** in `files.read` or knowledge ingestion.

Out of scope:

- Findings that require an already-compromised machine or an attacker with local root.
- Missing hardening on the reference `deploy/` stack when self-hosted with default env values —
  those are documented as needing real secrets.
- Vulnerabilities in upstream dependencies with no CockpitZero-specific exploit path (report those
  upstream; do tell us if we're pinned to a vulnerable version).
- Social engineering, physical access, and DoS by resource exhaustion.
- The `mock` AI provider — it is deterministic, offline, and never a real user's configured default.

## Handling secrets in reports

Never include a real API key, session token, OAuth token, or the contents of your secrets vault in a
report. Redact them. If you believe a key of yours was exposed by a CockpitZero bug, **revoke it at
the provider first**, then report.
