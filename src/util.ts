'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as expandTilde from 'expand-tilde';
import * as ini from 'node-ini';

export function scanAnsibleCfg( rootPath=undefined ) {
  console.log(`here is util.read_cfg()`);
  /*
  * Reading order:
  * 1) ANSIBLE_CONFIG
  * 2) ansible.cfg (in current workspace)
  * 3) ~/.ansible.cfg
  * 4) /etc/ansible.cfg
  */
  let cfgFiles = [
    `~/.ansible.cfg`,
    `/etc/ansible.cfg`
  ]
  if (rootPath != undefined) {
    cfgFiles.unshift( `${rootPath}/ansible.cfg` );
  }
  if (process.env.ANSIBLE_CONFIG != null) {
    cfgFiles.unshift( process.env.ANSIBLE_CONFIG );
  }
  var arrayLength = cfgFiles.length;
  for (var i = 0; i < arrayLength; i++)  {
    let cfgFile = cfgFiles[i]
    let cfgPath = expandTilde(cfgFile);

    let cfg = getValueByCfg(cfgPath);
    if (cfg != "") {
      // key: defaults.vault_password_file
      if (cfg.defaults != null && cfg.defaults.vault_password_file != null) {
        console.log(`Found ansible.cfg from ${cfgPath} contain defaults.vault_password_file`);
        return cfgPath;
      }
    }
  }

  return false;
}

let getValueByCfg = (path) => {
  console.log(`Reading ${path}...`);
  if (fs.existsSync(path)) {
    return ini.parseSync(path);
  }

  return "";
}
