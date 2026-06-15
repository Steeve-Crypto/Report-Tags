# VS Code Marketplace Listing

## Display Name

Git Sound Report

## Short Description

Celebratory audio feedback for successful Git commands, with opt-in analytics and team upgrade paths.

## Full Description

Make Git wins feel rewarding. Git Sound Report plays a short celebratory sound when successful Git activity is detected in VS Code.

### Features

- Plays audio on successful terminal Git commands when VS Code shell integration reports a zero exit code
- Supports `git add`, `git commit`, `git push`, merge, and checkout
- Optional Git hooks for reliable local commit, merge, and checkout events
- VS Code Git API commit detection for source-control UI workflows
- Status bar control for quick status, test sound, sponsor, and enterprise actions
- Custom sound file setting
- Opt-in PostHog telemetry for measuring activation and conversion

### Monetization Path

- Free: core sound feedback and basic configuration
- Sponsor: direct support button for fans of the extension
- Pro: premium sound packs, streaks, and custom event audio
- Enterprise: compiled native addon, custom audio engines, spatial/team deploy sound, and managed team packs

### Privacy

Telemetry is off by default. PostHog events are sent only when users explicitly enable telemetry and configure a PostHog project API key.

### Quick Start

1. Install the extension.
2. Run `Git Sound Report: Play Test Sound`.
3. Optional: configure `git-sound-report.soundPath`.
4. Optional: run `Git Sound Report: Install Git Hooks`.

## Publisher Checklist

- Replace placeholder repository URLs with the production repository.
- Add marketplace icon and screenshots.
- Add a bundled default sound or configure distribution around user-provided sounds.
- Verify `.vsix` packaging with `npm run package`.
