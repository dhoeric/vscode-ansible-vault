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

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "ansible-vault" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var toggleEncrypt = async () => {
        // Display a message box to the user
        let config = vscode.workspace.getConfiguration('ansibleVault');

        // Check file type and content if related to ansible vault
        let editor = vscode.window.activeTextEditor;
        if ( !editor ) {
            return;
        }

        let doc = editor.document;
        if ( doc.languageId != "yaml" ) {
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
            encrypt(doc.fileName, keypath);
        }
        else if ( fileType == "encrypted" ) {
            decrypt(doc.fileName, keypath);
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

let encrypt = (f, pass) => {
    console.log("Encrypt: " + f);

    let cmd = `ansible-vault encrypt ${f} --vault-password-file=${pass}`;
    exec(cmd);

    vscode.window.showInformationMessage(`${f} encrypted`);
}

let decrypt = (f, pass) => {
    console.log("Decrypt: " + f);

    let cmd = `ansible-vault decrypt ${f} --vault-password-file=${pass}`;
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