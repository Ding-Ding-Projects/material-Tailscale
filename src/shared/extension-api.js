// The extension protocol Material Tailscale speaks, shared by the main process (which runs
// extensions) and the renderer (which explains them). Version 1.
//
// An extension is a folder with a manifest.json and a program in any language. For each action
// the app starts the program, writes one JSON request to its standard input and reads one JSON
// answer from its standard output. See docs/features/extensions/writing-extensions.md.
'use strict';

const API_VERSION = 1;
const MANIFEST_VERSION = 1;

const LIMITS = {
  timeoutMs: 5000, // an extension that has not answered by then is stopped
  answerBytes: 64 * 1024, // a longer answer is refused
  message: 500,
  copy: 4000,
  url: 2000,
  checks: 20,
  checkTitle: 120,
  checkDetail: 500,
  runsKept: 10,
  folderBytes: 20 * 1024 * 1024, // largest extension folder that can be added
  folderFiles: 2000
};

// What each permission lets an extension see or do. The app hands an extension nothing else.
const PERMISSIONS = {
  'peer-details': {
    icon: 'devices',
    en: "See one device's name, MagicDNS name, Tailscale addresses, operating system, online state, tags and exit-node role, when you run one of its actions on that device.",
    yue: '當你喺某部裝置用佢嘅動作時，睇到嗰部裝置嘅名、MagicDNS 名、Tailscale 位址、作業系統、在線狀態、標籤同出口節點角色。'
  },
  'tailnet-status': {
    icon: 'monitor_heart',
    en: "See a summary of this device and tailnet: Tailscale version, connection state, this device's name, addresses and key expiry date, the exit node in use, how many devices are online, and health warnings.",
    yue: '睇到呢部裝置同 tailnet 嘅摘要：Tailscale 版本、連線狀態、本機名、位址同金鑰到期日、用緊嘅出口節點、幾多部裝置在線，同健康警告。'
  },
  clipboard: {
    icon: 'content_paste',
    en: 'Put text on the clipboard as the result of an action.',
    yue: '做完動作之後將文字放上剪貼簿。'
  },
  'open-url': {
    icon: 'open_in_browser',
    en: 'Open a web link (http or https) in your browser as the result of an action.',
    yue: '做完動作之後喺瀏覽器開一條網址（http 或 https）。'
  }
};

// Where an extension can add something, and the permission each place needs.
const HOOKS = {
  'peer.action': {
    icon: 'devices',
    needs: ['peer-details'],
    en: 'An action in the menu of every device',
    yue: '每部裝置選單入面嘅一個動作'
  },
  'status.check': {
    icon: 'monitor_heart',
    needs: ['tailnet-status'],
    en: 'A check in Diagnostics',
    yue: '診斷入面嘅一項檢查'
  }
};

// Never handed to any extension, whatever it asks for.
const NEVER_SENT = [
  ['Node, machine, disco and auth keys', '節點、機器、disco 同授權金鑰'],
  ['Admin API access tokens', '管理 API 存取權杖'],
  ['Account e-mail addresses and login names', '帳戶電郵同登入名'],
  ['Public network addresses of other devices', '其他裝置嘅公共網絡位址'],
  ['Passwords, authenticator secrets and anything in the system vault', '密碼、驗證器密鑰同系統保險箱入面嘅嘢']
];

const CHECK_STATES = ['ok', 'warn', 'fail'];

module.exports = { API_VERSION, MANIFEST_VERSION, LIMITS, PERMISSIONS, HOOKS, NEVER_SENT, CHECK_STATES };
