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
