'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as tilde from 'tilde-expansion';
import * as tmp from 'tmp';
import * as child_process from 'child_process';
import * as util from './util';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  var toggleEncrypt = async () => {
    let config = vscode.workspace.getConfiguration('ansibleVault');
    let editor = vscode.window.activeTextEditor;
    let doc = editor.document;
    if (!editor) {
      return;
    }

    // Get password
    let keypath = "";
    let pass = "";

    // Get rootPath based on multi-workspace API
    let rootPath = vscode.workspace.rootPath;
    if ( vscode.workspace.getWorkspaceFolder ) {
      let workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if ( workspaceFolder == undefined ) { // not under any workspace
        rootPath = undefined;
      }
      else {
        rootPath = workspaceFolder.uri.path;
      }
    }

    let keyInCfg = util.scanAnsibleCfg(rootPath);

    if ( keyInCfg != false ) {
      vscode.window.showInformationMessage(`Getting vault keyfile from ${keyInCfg}`);
    }
    else {
      // Find nothing from ansible.cfg
      if (config.keyfile != "") {
        let keyfile = config.keyfile.trim("/");
        keyfile = keyfile.trim("/");
        await tilde(keyfile, (s) => { keypath = s; });
      }

      // Need user to input the ansible-vault pass
      if (keypath == "") {
        pass = config.keypass;

        if (pass == "") {
          await vscode.window.showInputBox({ prompt: "Enter the ansible-vault keypass: " }).then((val) => {
            pass = val;
          })
        }

        keypath = tmp.tmpNameSync();
        let cmd = `touch ${keypath} && echo "${pass}" > ${keypath}`;
        exec(cmd);
      }
    }


    // Go encrypt / decrypt
    let fileType = await checkFileType(doc.fileName);
    if (fileType == "plaintext") {
      encrypt(doc.fileName, rootPath, keyInCfg, keypath, config);
    }
    else if (fileType == "encrypted") {
      decrypt(doc.fileName, rootPath, keyInCfg, keypath, config);
    }

    if (pass != "" && keypath != "") {
      exec(`rm -f ${keypath}`);
    }
  };

  let disposable = vscode.commands.registerCommand('extension.ansibleVault', toggleEncrypt);
  context.subscriptions.push(disposable);
}

// Check YAML file content
// start with '$ANSIBLE_VAULT' -> 'decrypt'
// others -> 'encrypt'
let checkFileType = async (f) => {
  let content = '';
  await vscode.workspace.openTextDocument(f).then((document) => {
    content = document.getText();
  });

  if (content.indexOf("$ANSIBLE_VAULT") == 0) {
    return 'encrypted';
  }

  return 'plaintext';
}

let encrypt = (f, rootPath, keyInCfg, pass, config) => {
  console.log("Encrypt: " + f);

  let cmd = `${config.executable} encrypt "${f}"`;
  // Specify vault-password-file when vault_password_file not in ansible.cfg
  if (!keyInCfg) {
    cmd += ` --vault-password-file="${pass}"`;
  }

  if ( rootPath != undefined ) {
    exec(cmd, { cwd: rootPath });
  } else {
    exec(cmd);
  }

  vscode.window.showInformationMessage(`${f} encrypted`);
}

let decrypt = (f, rootPath, keyInCfg, pass, config) => {
  console.log("Decrypt: " + f);

  let cmd = `${config.executable} decrypt "${f}"`;
  // Specify vault-password-file when vault_password_file not in ansible.cfg
  if (!keyInCfg) {
    cmd += ` --vault-password-file="${pass}"`;
  }

  if ( rootPath != undefined ) {
    exec(cmd, { cwd: rootPath });
  } else {
    exec(cmd);
  }

  vscode.window.showInformationMessage(`${f} decrypted`);
}

let exec = (cmd, opt={}) => {
  console.log(`> ${cmd}`);
  let stdout = child_process.execSync(cmd, opt);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
