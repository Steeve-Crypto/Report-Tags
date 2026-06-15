const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Git Sound Report extension is now active!');

    // Command for test sound
    let disposable = vscode.commands.registerCommand('gitSoundReport.playTestSound', () => {
        playSound();
        vscode.window.showInformationMessage('Test sound played!');
    });

    context.subscriptions.push(disposable);

    // Listen to terminals
    let terminals = vscode.window.terminals;
    terminals.forEach(setupTerminalListener);
    vscode.window.onDidOpenTerminal(setupTerminalListener);

    // For git API if available
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
        gitExtension.activate().then(() => {
            const gitAPI = gitExtension.exports.getAPI(1);
            if (gitAPI) {
                console.log('Git API available');
                // Listen to repository changes or pushes
                gitAPI.repositories.forEach(repo => {
                    setupGitRepoListener(repo);
                });
                gitAPI.onDidChangeRepository(repo => setupGitRepoListener(repo));
            }
        });
    }
}

function setupTerminalListener(terminal) {
    // Note: Limited API, use shell integration or output monitoring
    console.log('Terminal opened:', terminal.name);
    // For demonstration, we can listen to process if possible, but use child_process for git
}

function setupGitRepoListener(repo) {
    // Monitor push etc.
    console.log('Git repo:', repo.rootUri.fsPath);
    // Example: listen to state changes if possible
}

function playSound() {
    const pythonScript = path.join(__dirname, 'play_sound.py');
    const pythonProcess = spawn('python3', [pythonScript]);
    
    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
    });
}

exports.activate = activate;

// For deactivate if needed
function deactivate() {}

exports.deactivate = deactivate;