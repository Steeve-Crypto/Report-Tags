const path = require('path');

const SOUND_PROFILES = {
  tiny_win: {
    label: 'Tiny Win',
    volume: 'quiet',
    file: path.join('assets', 'sounds', 'tiny_win.wav')
  },
  bug_fix: {
    label: 'Bug Fix',
    volume: 'medium',
    file: path.join('assets', 'sounds', 'bug_fix.wav')
  },
  feature_ship: {
    label: 'Feature Ship',
    volume: 'medium',
    file: path.join('assets', 'sounds', 'feature_ship.wav')
  },
  risky_change: {
    label: 'Risky Change',
    volume: 'controlled',
    file: path.join('assets', 'sounds', 'risky_change.wav')
  },
  deploy_win: {
    label: 'Deploy Win',
    volume: 'bright',
    file: path.join('assets', 'sounds', 'deploy_win.wav')
  },
  test_green: {
    label: 'Test Green',
    volume: 'clean',
    file: path.join('assets', 'sounds', 'test_green.wav')
  },
  major_release: {
    label: 'Major Release',
    volume: 'loud',
    file: path.join('assets', 'sounds', 'major_release.wav')
  }
};

function getSoundProfile(profileName) {
  return SOUND_PROFILES[profileName] || SOUND_PROFILES.feature_ship;
}

function getSoundProfilePath(extensionDir, profileName) {
  const profile = getSoundProfile(profileName);
  return path.join(extensionDir, profile.file);
}

module.exports = {
  SOUND_PROFILES,
  getSoundProfile,
  getSoundProfilePath
};
