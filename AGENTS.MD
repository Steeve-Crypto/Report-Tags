# AGENTS.MD - Git Sound Report Extension

Always read this file before any work

## Strategic Vision (- CTO/Finance Focus)
This VS Code extension is the MVP for a **revenue-generating developer productivity platform**. 
Core hook: Celebratory "report tag" audio feedback on successful Git production commands (add, commit, push to GitHub). 
**Goal**: Drive emotional engagement → retention → monetization funnel.

**Primary Agent Role**: Oversees technical architecture, financial modeling, and product roadmap for sustainable revenue.

### Project Architecture
- **Extension Layer**: `extension.js` (pure JS) — VS Code API integration, command registration, terminal/Git event monitoring, Python spawning.
- **Audio Engine**: `play_sound.py` — Python (playsound or pygame) for cross-platform sound playback. Easy to swap sound packs.
- **Performance Layer (Future)**: C++ Node native addon for ultra-low-latency system audio (Windows `PlaySound`, macOS `NSSound`, Linux ALSA/PulseAudio).
- **Detection Strategy**: Hybrid — VS Code Git API + terminal output parsing + Git post-hooks for reliable success signals.

**Tech Stack Rationale (CTO Lens)**:
- Minimal footprint, fast iteration.
- Python for rapid audio experimentation.
- C++ for enterprise-grade performance in high-volume CI/CD monitoring.

### Monetization & Revenue Plan
1. **Freemium Model** (Core free on VS Marketplace):
   - Base sounds + basic triggers.
2. **Premium Tiers**:
   - Custom sound packs ($4.99–$9.99 one-time or subscription).
   - Streak counters, leaderboards, analytics dashboard.
   - Team/Enterprise: Shared celebrations, Slack/Teams integration, deployment metrics.
3. **Additional Streams**:
   - Sponsorships from audio tools, GitHub, or dev tooling companies.
   - Affiliate revenue via linked premium services.
   - White-label "Deploy Party" modules for other IDEs.
4. **Metrics to Track**: Downloads, activation rate, premium conversion (target 8-12%), retention via sound feedback loops.

**Projected Revenue**: Start with 10k users → 5% conversion = meaningful MRR. Scale into full Athena Productivity Suite.

### Roadmap & Agent Tasks
- **Phase 1 (MVP - Done)**: Basic sound on test + git hooks.
- **Phase 2**: Robust success detection, config UI, multiple sounds.
- **Phase 3**: C++ native module + telemetry.
- **Phase 4**: Marketplace publishing + paid features rollout.
- **Phase 5**: Expand to other CI/CD events, build status sounds, full gamification.

### File Inventory
- `package.json` — Manifest + contributes
- `extension.js` — Activation & orchestration
- `play_sound.py` — Sound player
- `report_tag_success.mp3` (placeholder — add your file)
- `README.md` — User guide

**Status**: Production-ready MVP. Ready for packaging and launch.

**Next Financial/Technical Priorities**:
- A/B test sound variants for engagement.
- Implement opt-in analytics for conversion funnel optimization.
- Prepare .vsix for immediate distribution.