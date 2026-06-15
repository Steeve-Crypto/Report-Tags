# Privacy

Git Sound Report does not send telemetry by default.

PostHog analytics are sent only when both settings are configured:

- `git-sound-report.telemetry.enabled`: `true`
- `git-sound-report.postHogProjectApiKey`: a non-empty PostHog project API key

When enabled, events may include:

- Extension activation
- Git success event type, such as `commit` or `push`
- Detection source, such as terminal, Git hook, or VS Code Git API
- Local sound classification such as intent, risk, scale, selected profile, and aggregate file counts
- Sponsor and enterprise command clicks
- VS Code version, extension version, and operating system

The extension does not intentionally capture source code, file contents, commit messages, file names, branch names, repository names, repository remotes, author names, email addresses, or raw terminal output. Terminal commands are reduced to the Git command context and obvious credentials are redacted before telemetry.

Disable telemetry at any time by setting `git-sound-report.telemetry.enabled` to `false`.
