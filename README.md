# Git Sound Report VS Code Extension

Plays a celebratory "report tag" sound on successful `git add`, `git commit`, `git push` etc. to GitHub.

## Features
- Sound on git success (Python backend)
- Test command in palette
- Ready for C++ native audio addon

## Setup
1. `npm install` (if adding deps)
2. `pip install playsound`
3. Add `report_tag_success.mp3` to folder
4. Package: `vsce package`
5. Install .vsix

Built with Python + JS. C++ for native perf optional.
# Git Sound Report VS Code Extension

Plays a celebratory 'report tag' sound on successful git add, commit, push to GitHub.

## Setup
1. Install playsound: pip install playsound
2. Place a sound file (e.g. report_tag.mp3) in the extension folder.
3. Update play_sound.py to point to it.
4. Package and install the extension.

## Features
- Monitors terminal for git success.
- Uses Python for sound playback.
- C++ can be integrated via Node addon for native performance (advanced).

To enhance monitoring, consider git hooks or better terminal parsing.
# Native C++ Sound Addon (Enterprise)

For low-latency, native audio playback without Python dependency.

## Build
```bash
cd native-sound
npm install node-addon-api
node-gyp configure build
```

Then in extension.js:
```js
const nativeSound = require('./native-sound/build/Release/soundaddon.node');
nativeSound.playReportTag();
```

**Enterprise Benefits**: 
- Zero Python overhead
- Better security/compliance
- Faster response for high-frequency events
- Custom audio mixing