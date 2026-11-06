// Hong Kong Cantonese titles for every CLI catalogue command.
export const YUE_TITLES = {
  up: '連線（up）', down: '斷線（down）', set: '偏好設定（set）', get: '讀取偏好（get）', login: '登入／加帳戶', logout: '登出',
  'switch-list': '帳戶列表', switch: '切換帳戶', 'switch-remove': '移除帳戶', whoami: '我係邊個',
  status: '狀態', ping: 'Ping', netcheck: '網絡檢查', ip: 'Tailscale IP', whois: '查身份', wait: '等待運行', version: '版本',
  'metrics-print': '用戶端指標', 'metrics-write': '寫指標去檔案', bugreport: '錯誤報告',
  'exit-node-list': '出口節點列表', 'exit-node-suggest': '建議出口節點',
  'dns-status': 'DNS 狀態', 'dns-query': 'DNS 查詢',
  serve: '分享服務（Serve）', 'serve-off': '停止 Serve', 'serve-status': 'Serve 狀態', 'serve-reset': '重設 Serve', 'serve-drain': '排空服務', 'serve-advertise': '宣告服務',
  'serve-get-config': '匯出服務設定', 'serve-set-config': '套用服務設定', 'service-list': 'Tailscale 服務',
  funnel: '公開分享（Funnel）', 'funnel-off': '停止 Funnel', 'funnel-status': 'Funnel 狀態', 'funnel-reset': '重設 Funnel',
  'file-cp': '傳送檔案', 'file-targets': '可傳送裝置', 'file-get': '接收檔案', cert: 'HTTPS 證書',
  'lock-status': '鎖狀態', 'lock-init': '啟用網絡鎖', 'lock-add': '加信任鎖匙', 'lock-remove': '移除信任鎖匙', 'lock-sign': '簽署節點或驗證鎖匙',
  'lock-disable': '停用網絡鎖', 'lock-local-disable': '只喺本機停用', 'lock-disablement-kdf': '停用 KDF', 'lock-log': '鎖紀錄', 'lock-revoke-keys': '撤銷外洩鎖匙',
  'drive-list': 'Taildrive 共享', 'drive-share': '共享資料夾', 'drive-rename': '改共享名', 'drive-unshare': '停止共享',
  'appc-routes': 'App 連接器路由', 'syspolicy-list': '系統政策', 'syspolicy-reload': '重新載入系統政策', update: '更新 Tailscale', web: '本機網頁介面', licenses: '開源授權',
  'configure-kubeconfig': 'kubeconfig', 'configure-systray': '系統匣自動啟動', 'configure-synology': 'Synology 對外連線',
  'configure-mac-vpn-install': 'macOS VPN 設定：安裝', 'configure-mac-vpn-uninstall': 'macOS VPN 設定：移除',
  'configure-sysext-activate': '系統延伸：啟用', 'configure-sysext-deactivate': '系統延伸：停用', 'configure-sysext-status': '系統延伸：狀態',
  systray: 'Linux 系統匣', completion: 'Shell 自動完成', ssh: 'Tailscale SSH', nc: 'Netcat 去裝置'
};

export const YUE_GROUPS = {
  connection: '連線', account: '帳戶', status: '狀態同診斷', exit: '出口節點', dns: 'DNS', serve: 'Serve、Funnel 同服務',
  taildrop: 'Taildrop 傳檔', cert: '證書', lock: '網絡鎖', drive: 'Taildrive', system: '系統', configure: '設定', connect: '連接'
};
