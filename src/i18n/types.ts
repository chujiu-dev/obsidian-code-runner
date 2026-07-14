export type LanguageSetting = 'en' | 'zh' | 'auto';
export type ResolvedLanguage = 'en' | 'zh';

/** Structured key space for all user-facing strings. */
export interface LocaleMap {
  // -- stdin / input area --
  'stdin.unsupported': string;
  'stdin.interactive.hint': string;
  'stdin.interactive.placeholder': string;
  'stdin.firstPromptPlaceholder': string;
  'stdin.label.input': string;
  'stdin.label.dynamic': string;
  'stdin.insufficient.worker': string;
  'stdin.insufficient.body': string;

  // -- UI chrome --
  'ui.run': string;
  'ui.play': string;
  'ui.closeInput': string;
  'ui.cancelStdin': string;
  'ui.submit': string;
  'ui.stop': string;
  'ui.clearOutput': string;
  'ui.toggleInput': string;
  'ui.terminate': string;

  // -- settings tab --
  'settings.language.name': string;
  'settings.language.desc': string;
  'settings.language.auto': string;
  'settings.comingSoon.heading': string;
  'settings.ioPrompts.name': string;
  'settings.ioPrompts.desc': string;
  'settings.autoComplete.name': string;
  'settings.autoComplete.desc': string;
  'settings.additionalPlugins.heading': string;
  'settings.additionalPlugins.desc': string;

  // -- pyodide / worker --
  'worker.error': string;
  'pyodide.loadError': string;
  'pyodide.initError': string;
  'pyodide.notInitialized': string;
  'pyodide.setupError': string;
  'pyodide.injectError': string;
  'pyodide.genericError': string;

  // -- sololearn diagnostics --
  'diag.defaultLabel': string;
  'diag.errorCount': string;
  'diag.warningCount': string;

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': string;
}
