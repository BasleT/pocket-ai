import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pocket AI',
    description: 'AI browser sidebar for chat and summarization',
    permissions: [
      'activeTab',
      'storage',
      'sidePanel',
      'scripting',
      'contextMenus',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open Pocket AI',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      'toggle-sidepanel': {
        suggested_key: {
          default: 'Alt+Shift+P',
        },
        description: 'Toggle Pocket AI side panel',
      },
    },
  },
});
