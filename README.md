# VSCode ansible-vault extension
[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/d/dhoeric.ansible-vault.svg)](https://marketplace.visualstudio.com/items?itemName=dhoeric.ansible-vault)

VSCode extensions to encrypt/decrypt ansible-vault file, can toggle with <kbd>ctrl+alt+0</kbd>
_inspired by https://github.com/sydro/atom-ansible-vault_

![Encryption demo](images/demo.gif)


## Usage
To read vault password file in your computer, you can specify the `vault_password_file` in ansible.cfg or through [extension settings](#extension-settings).


## Requirements

- Ansible


## Extension Settings

This extension contributes the following settings:

* `ansibleVault.executable`: Full path of ansible-vault executable (e.g. `/usr/local/bin/ansible-vault`)
* `ansibleVault.keyfile`: Ansible-vault password file path (e.g. `~/.vault-pass.txt`)
* `ansibleVault.keypass`: Ansible-vault password text (e.g. `GT6rAP7rxYzeFC1KtHVW`)
