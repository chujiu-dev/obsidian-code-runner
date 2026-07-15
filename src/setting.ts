import type { LanguageSetting } from './i18n/types';

export interface PluginSetting {
  /** UI language for the plugin interface. 'auto' follows Obsidian, 'en' | 'zh' override. */
  language: LanguageSetting;
  /** Python (Pyodide) runtime settings. */
  python: {
    /** Base URL for loading Pyodide. */
    cdn: string;
  };
}

export const SETTING_DEFAULT: PluginSetting = {
  language: 'auto',
  python: {
    cdn: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
  }
};

export default SETTING_DEFAULT;
