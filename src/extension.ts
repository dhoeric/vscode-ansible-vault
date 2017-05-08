'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as tilde from 'tilde-expansion';
import * as tmp from 'tmp';
import * as child_process from 'child_process';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    var toggleEncrypt = async () => {
        let config = vscode.workspace.getConfiguration('ansibleVault');
        let editor = vscode.window.activeTextEditor;
        if ( !editor ) {
            return;
        }

        let doc = editor.document;
        if ( ! (doc.languageId == "yaml" || doc.languageId == "ansible") ) {
            return;
        }


        // Get password
        let keypath = "";
        let pass = "";
        let tmpFileObj = '';
        if (config.keyfile != "") {
            let keyfile = config.keyfile.trim("/");
            keyfile = keyfile.trim("/");
            await tilde(keyfile, (s) => { keypath = s; });
        }


        if (keypath ==  "") {
            pass = config.keypass;

            if (pass == "") {
                await vscode.window.showInputBox({prompt: "Enter the ansible-vault keypass: "}).then((val) => {
                    pass = val;
                })
            }

            keypath = tmp.tmpNameSync();
            let cmd = `touch ${keypath} && echo "${pass}" > ${keypath}`;
            exec(cmd);
        }


        // Go encrypt / decrypt
        let fileType = await checkFileType(doc.fileName);
        if ( fileType == "plaintext" ) {
            encrypt(doc.fileName, keypath, config);
        }
        else if ( fileType == "encrypted" ) {
            decrypt(doc.fileName, keypath, config);
        }

        if ( pass != "" && keypath != "" ) {
            exec(`rm -f ${keypath}`);
        }
    };

    let disposable = vscode.commands.registerCommand('extension.ansibleVault', toggleEncrypt);
    context.subscriptions.push(disposable);
}

// Check YAML file content
// start with '$ANSIBLE_VAULT' -> 'decrypt'
// others -> 'encrypt'
let checkFileType = async(f) => {
    let content = '';
    await vscode.workspace.openTextDocument(f).then((document) => {
        content = document.getText();
    });

    if ( content.indexOf("$ANSIBLE_VAULT") == 0 ) {
        return 'encrypted';
    }

    return 'plaintext';
}

let encrypt = (f, pass, config) => {
    console.log("Encrypt: " + f);

    let cmd = `${config.executable} encrypt "${f}" --vault-password-file="${pass}"`;
    exec(cmd);

    vscode.window.showInformationMessage(`${f} encrypted`);
}

let decrypt = (f, pass, config) => {
    console.log("Decrypt: " + f);

    let cmd = `${config.executable} decrypt "${f}" --vault-password-file="${pass}"`;
    exec(cmd);

    vscode.window.showInformationMessage(`${f} decrypted`);
}

let exec = (cmd) => {
    console.log(`> ${cmd}`);
    let stdout = child_process.execSync(cmd, {});
}

// this method is called when your extension is deactivated
export function deactivate() {
}
