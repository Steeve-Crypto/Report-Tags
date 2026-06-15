# Native Sound Addon Prototype

This directory is the enterprise-track prototype for low-latency audio. It is intentionally excluded from the free Marketplace package through `.vscodeignore`.

Current scope:

- Windows WAV playback through `PlaySoundW`
- JavaScript API: `playReportTag(soundPath: string): boolean`

Build:

```bash
cd native-sound
npm install node-addon-api
node-gyp configure build
```

Commercial expansion:

- Signed prebuilt binaries
- macOS and Linux engines
- Spatial/team deploy sound
- Admin-managed sound packs
- Enterprise support and integration contracts
