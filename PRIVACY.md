# Privacy

Space Report does not send telemetry by default.

PostHog analytics are sent only when telemetry is enabled and a PostHog key is available:

- `git-sound-report.telemetry.enabled`: `true`
- PostHog project API key saved with `Space Report: Set PostHog API Key`

When enabled, events may include:

- Extension activation
- Git success event type, such as `commit` or `push`
- Detection source, such as terminal, Git hook, or VS Code Git API
- Local sound classification such as intent, risk, scale, selected profile, and aggregate file counts
- Local streak, momentum, and sound feedback scores when used for personalization
- Sponsor and enterprise command clicks
- VS Code version, extension version, and operating system

The extension does not intentionally capture source code, file contents, commit messages, file names, branch names, repository names, repository remotes, author names, email addresses, or raw terminal output. Terminal commands are reduced to the Git command context and obvious credentials are redacted before telemetry.

Adaptive sound state is stored locally in VS Code global storage. Voice summaries use local operating-system text-to-speech where available. Team deploy webhooks are disabled by default; if enabled, deploy and major-release summaries are sent to the configured webhook URL with classification metadata such as profile, intent, risk, scale, and momentum.

Disable telemetry at any time by setting `git-sound-report.telemetry.enabled` to `false`.

The recommended key path uses VS Code SecretStorage. Do not store the key in committed workspace settings.
