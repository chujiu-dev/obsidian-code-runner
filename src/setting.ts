import type { App } from 'obsidian';
import type { LanguageSetting } from './i18n/types';

export interface PluginSetting {
  /** UI language for the plugin interface. 'auto' follows Obsidian, 'en' | 'zh' override. */
  language: LanguageSetting;
}

export default {
  language: 'auto',
  python: {
    cdn: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
  }
} as PluginSetting;

// ── Shared app reference (set once during plugin onload, used by Play.tsx for vault-scoped localStorage) ──
let _app: App | null = null;

export function setApp(app: App): void { _app = app; }
export function getApp(): App {
  if (!_app) throw new Error('[Code Runner] App not initialized');
  return _app;
}
