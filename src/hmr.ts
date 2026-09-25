import type { Plugin } from 'obsidian';
import { debounce, Platform, normalizePath } from 'obsidian';

// Only this module needs it, and only in a dev build (see `vite.config.ts`,
// which injects it when `mode !== 'production'`), so the declaration lives here
// rather than in a global typings patch.
declare global {
  interface Window {
    hmr?: (plugin: Plugin, wait?: number) => void;
  }
}

const hmr = (plugin: Plugin, wait= 500) => {
  if (Platform.isMobile) {
    return;
  }

  // `debug` rather than `log`: this runs every time the plugin is reloaded by
  // the watcher below, and it is only ever useful while developing.
  console.debug(`[hmr: ${plugin.manifest.name}]`);

  const {
    app: {
      vault: { adapter },
      plugins,
    },
    manifest: { dir: pluginDir, id },
  } = plugin;
  const {
    app: { vault },
  } = plugin;
  const entry = normalizePath(pluginDir + '/main.js');
  const onChange = async (file: string) => {
    if (file.startsWith(pluginDir)) {
      if (!await adapter.exists(entry)) {
        return
      }
      await plugins.disablePlugin(id);
      await plugins.enablePlugin(id);
    }
  };

  plugin.registerEvent(vault.on('raw', debounce(onChange, wait)));

  plugin.register(() => adapter.stopWatchPath(pluginDir));
  adapter.startWatchPath(pluginDir);
}

if (!window.hmr) {
  Window.prototype.hmr = hmr
}
export {};
