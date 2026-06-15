const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');

function activate(context) {
  console.log('🚀 Git Sound Report activated');

  // Test command
  context.subscriptions.push(vscode.commands.registerCommand('gitSoundReport.playTestSound', () => {
    playSound();
    vscode.window.showInformationMessage('🎉 Report tag sound played! Test successful.');
  }));

  // Monitor terminals for git commands
  vscode.window.onDidOpenTerminal((terminal) => {
    console.log(`Monitoring terminal: ${terminal.name}`);
  });

  // TODO: Enhance with Git API and terminal output parsing for success detection
  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (gitExt) {
    gitExt.activate().then(() => {
      const gitAPI = gitExt.exports.getAPI(1);
      console.log('Git API available for advanced hooks');
    });
  }
}

function playSound() {
  const pyPath = path.join(__dirname, 'play_sound.py');
  const proc = spawn('python3', [pyPath], { shell: true });
  proc.stdout.on('data', (data) => console.log(data.toString()));
  proc.stderr.on('data', (data) => console.error(data.toString()));
  proc.on('close', (code) => {
    if (code !== 0) console.warn(`Python process exited with code ${code}`);
  });
}

exports.activate = activate;
exports.deactivate = () => {};
