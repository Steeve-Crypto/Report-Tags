# VS Code Marketplace Listing

## Display Name

Git Sound Report

## Short Description

Celebratory adaptive audio feedback for successful Git commands.

## Full Description

Make Git wins feel rewarding. Git Sound Report plays a short celebratory sound when successful Git activity is detected in VS Code.

### Features

- Plays audio on successful terminal Git commands when VS Code shell integration reports a zero exit code
- Supports `git add`, `git commit`, `git push`, merge, and checkout
- Optional Git hooks for reliable local commit, merge, and checkout events
- VS Code Git API commit detection for source-control UI workflows
- Status bar control for quick status, test sound, sponsor, and sound feedback actions
- Custom sound file setting
- Opt-in PostHog telemetry for measuring activation and conversion

### Monetization Path

- Free: core sound feedback and basic configuration
- Sponsor: direct support button for fans of the extension
- Future paid options: premium sound packs, custom event audio, and native audio

### Privacy

Telemetry is off by default. PostHog events are sent only when users explicitly enable telemetry and configure a PostHog project API key.

### Quick Start

1. Install the extension.
2. Run `Git Sound Report: Play Test Sound`.
3. Optional: configure `git-sound-report.soundPath`.
4. Optional: run `Git Sound Report: Install Git Hooks`.

## Publisher Checklist

- Confirm repository URL is `https://github.com/Steeve-Crypto/Report-Tags`.
- Add screenshots if needed.
- Verify `.vsix` packaging with `npm run package`.
