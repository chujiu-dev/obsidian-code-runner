import type { LanguageSetting } from './i18n/types';

/**
 * Default Pyodide CDN. Single source of truth — `backend/languages/python.ts`
 * imports this rather than repeating the URL.
 */
export const DEFAULT_PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

export interface PluginSetting {
  /**
   * UI language for the plugin interface. 'auto' follows Obsidian.
   * 'zh' is still accepted (legacy settings) and resolves to the Chinese
   * locale; the settings dropdown only offers 'auto' and 'en'.
   */
  language: LanguageSetting;
  /**
   * Wrap an incomplete snippet in a runnable program before running it — add
   * the missing entry point and the includes the snippet actually uses.
   *
   * Top-level rather than nested: `main.tsx` merges one level of nesting by
   * hand, and a new nested object would need that merge extended.
   */
  autoSkeleton: boolean;
  /** Python (Pyodide) runtime settings. */
  python: {
    /** Base URL for loading Pyodide. */
    cdn: string;
  };
}

export const SETTING_DEFAULT: PluginSetting = {
  language: 'auto',
  autoSkeleton: true,
  python: {
    cdn: DEFAULT_PYODIDE_CDN
  }
};

export default SETTING_DEFAULT;
