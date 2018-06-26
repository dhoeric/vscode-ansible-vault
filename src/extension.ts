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
  let getVaultKey = async () => {
    let config = vscode.workspace.getConfiguration('ansibleVault');
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get password
    let keypath = "";
    let pass = "";
    let removeVaultKey = false;
    let takeKeyFromAnsibleConfig = false;

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
      takeKeyFromAnsibleConfig = true;
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
        removeVaultKey = true;
        exec(cmd);
      }
    }
    
    return { vaultKeyPath: keypath, takeKeyFromAnsibleConfig, removeVaultKey, rootPath, editor: editor, config };
  }


  let toggleEncrypt = async () => {
    let preflightResult = await getVaultKey();
    if(!preflightResult) {
      return;
    }

    let doc = preflightResult.editor.document;
    // Go encrypt / decrypt
    if (! await checkIfFileIsEncrypted(doc.fileName)) {
      encryptFile(doc.fileName, preflightResult.rootPath, preflightResult.takeKeyFromAnsibleConfig, preflightResult.vaultKeyPath, preflightResult.config);
    }
    else {
      decryptFile(doc.fileName, preflightResult.rootPath, preflightResult.takeKeyFromAnsibleConfig, preflightResult.vaultKeyPath, preflightResult.config);
    }

    if (preflightResult.removeVaultKey) {
      exec(`rm -f ${preflightResult.vaultKeyPath}`);
    }
  };

  let prepareEncryptedText = (str: string) => {
    let lines = str.trim().split(/\r?\n/);
    if (lines.length > 1) {
      // skip first line "!vault |"
      lines = lines.slice(1);
    }
    // strip each line because of indent and join again
    let preparedString: string = lines.map((str: string) => str.trim()).join("\n");
    return preparedString;
  }

  let toggleStringEncryption = async () => {
    let preflightResult = await getVaultKey();
    if(!preflightResult) {
      return;
    }

    let selection = preflightResult.editor.selection;
    let selectedText = preflightResult.editor.document.getText(selection);
    
    let we = new vscode.WorkspaceEdit();
    if (checkIfStringIsEncrypted(selectedText)) {
      // string encrypted, decrypt
      let decryptedText = decryptString(prepareEncryptedText(selectedText), preflightResult.takeKeyFromAnsibleConfig, preflightResult.vaultKeyPath, preflightResult.config)
      we.replace(preflightResult.editor.document.uri, new vscode.Range(selection.start, selection.end), decryptedText);
    }
    else {
      // encrypt
      let encryptedText = encryptString(selectedText, preflightResult.takeKeyFromAnsibleConfig, preflightResult.vaultKeyPath, preflightResult.config)
      we.replace(preflightResult.editor.document.uri, new vscode.Range(selection.start, selection.end), encryptedText);
    }

    vscode.workspace.applyEdit(we);

    if (preflightResult.removeVaultKey) {
      exec(`rm -f ${preflightResult.vaultKeyPath}`);
    }
  };

  let toggleFileCommand = vscode.commands.registerCommand('extension.ansibleVault', toggleEncrypt);
  context.subscriptions.push(toggleFileCommand);
  let toggleStringCommand = vscode.commands.registerCommand('extension.toggleStringEncryption', toggleStringEncryption);
  context.subscriptions.push(toggleStringCommand);

}

// Check YAML file content
// start with '$ANSIBLE_VAULT' -> 'decrypt'
// others -> 'encrypt'
let checkIfFileIsEncrypted = async (f) => {
  let content = '';
  await vscode.workspace.openTextDocument(f).then((document) => {
    content = document.getText();
  });

  if (content.indexOf("$ANSIBLE_VAULT") == 0) {
    return true;
  }

  return false;
}

let checkIfStringIsEncrypted = (str: string) => {
  if (str.trim().indexOf("!vault") == 0) {
    return true;
  }
  return false;
}

let encryptFile = (f, rootPath, keyInCfg, pass, config) => {
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

let encryptString = (str: string, keyInCfg: boolean, pass: string, config: any) => {
  let cmd = `echo '${str}\\c' | ${config.executable} - encrypt_string`;
  // Specify vault-password-file when vault_password_file not in ansible.cfg
  if (!keyInCfg) {
    cmd += ` --vault-password-file="${pass}"`;
  }
  return exec(cmd).trim()
}

let decryptFile = (f, rootPath, keyInCfg, pass, config) => {
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

let decryptString = (str: string, keyInCfg: boolean, pass: string, config: any) => {
  let cmd = `echo '${str}' | ${config.executable} decrypt -`;
  // Specify vault-password-file when vault_password_file not in ansible.cfg
  if (!keyInCfg) {
    cmd += ` --vault-password-file="${pass}"`;
  }
  return exec(cmd);
}

let exec = (cmd, opt={}) => {
  console.log(`> ${cmd}`);
  let stdout = child_process.execSync(cmd, opt);
  return stdout.toString();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
