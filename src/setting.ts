export interface PluginSetting {
    /** Future: auto-detect stdin requirement and show keyboard icon automatically. */
    autoStdin: boolean,

    // ── Reserved for future features ──

    /** UI language for the plugin interface. */
    language: 'en' | 'zh',

    /** [Coming soon] Code auto-completion via language server integration. */
    enableAutoComplete: boolean,
    /** [Coming soon] Enhanced real-time syntax highlighting during editing. */
    enableEnhancedHighlight: boolean,
}

export default {
  autoStdin: false,
  language: 'en',
  enableAutoComplete: false,
  enableEnhancedHighlight: false,
  python: {
    cdn: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
  }
} as PluginSetting;