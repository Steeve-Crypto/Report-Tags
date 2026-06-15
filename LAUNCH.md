# Public Launch Runbook

## Required External Config

Before publishing publicly, set these real account values:

- Marketplace publisher ID: confirm that `athena-devtools` exists in Visual Studio Marketplace publisher management, or replace `publisher` in `package.json`.
- Repository URL: replace `https://github.com/athena-devtools/git-sound-report` if the production repo is under another account.
- Sponsor URL: currently set to `https://github.com/sponsors/Steeve-Crypto`.
- Enterprise URL: replace `git-sound-report.enterpriseUrl` with a real landing page, GitHub discussion, email form, or Stripe checkout page.
- PostHog project API key: set `git-sound-report.postHogProjectApiKey` after creating a PostHog project.
- Privacy posture: keep telemetry opt-in unless you have reviewed Marketplace expectations and your privacy copy.
- AI positioning: current adaptive sound is local-first and rule-based. Market it as intelligent/adaptive, not as cloud LLM analysis.

## Local Release Checks

```bash
npm install
npm run lint
npm run package
```

Install the packaged VSIX locally:

```bash
code --install-extension git-sound-report-0.2.0.vsix
```

Manual smoke test:

1. Run `Git Sound Report: Play Test Sound`.
2. Open a Git workspace.
3. Run `Git Sound Report: Install Git Hooks`.
4. Run `git commit --allow-empty -m "test git sound report"` in the integrated terminal.
5. Run `git push` from a test branch if you want to verify push detection.
6. Confirm the sponsor command opens `https://github.com/sponsors/Steeve-Crypto`.
7. If PostHog is enabled, confirm events arrive in PostHog.

## Marketplace Publish

Microsoft's official VS Code docs describe two public paths:

- Package with `vsce package` and upload the `.vsix` manually in Marketplace publisher management.
- Publish from the CLI with `vsce publish`.

For a first launch, manual upload is usually easier to control:

1. Create or verify the Visual Studio Marketplace publisher.
2. Confirm `publisher` in `package.json` exactly matches that publisher ID.
3. Run `npm run package`.
4. Upload `git-sound-report-0.2.0.vsix` in Marketplace publisher management.
5. Review the rendered README, icon, category, and links before making it public.

For CLI publishing:

```bash
npx vsce login <publisher-id>
npx vsce publish
```

Microsoft recommends Entra ID based automated publishing for CI/CD. Global Azure DevOps PATs are retired on December 1, 2026, so do not build a long-term launch process around global PATs.

## GitHub Launch

1. Push the source repo publicly.
2. Create a GitHub release named `v0.2.0`.
3. Attach `git-sound-report-0.2.0.vsix`.
4. Add install instructions for Marketplace and VSIX users.
5. Pin a sponsor link to `https://github.com/sponsors/Steeve-Crypto`.
6. Add topics: `vscode-extension`, `git`, `productivity`, `developer-tools`, `posthog`, `gamification`.

## Product Launch Copy

Short post:

> I launched Git Sound Report, a VS Code extension that plays a quick celebratory sound when Git commands succeed. Free core, opt-in analytics, sponsor support, and an enterprise path for custom/native audio engines.

CTA:

> Install it, run a test sound, then make your next commit feel less boring.

AI/adaptive version:

> Git Sound Report now chooses different success sounds based on local Git metadata: fixes, tests, risky changes, deploys, and major releases all feel different.

## First 7 Days

- Track installs, activation, test sound, Git success events, sponsor clicks, and enterprise clicks.
- Ask early users which sound packs they want.
- Publish one demo GIF or short video.
- Open GitHub issues for Pro sound packs, streaks, and enterprise native audio.
- Do not add default telemetry until privacy and consent are fully reviewed.
