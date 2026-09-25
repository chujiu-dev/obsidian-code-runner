export type LanguageSetting = 'en' | 'zh' | 'auto';
export type ResolvedLanguage = 'en' | 'zh';

/** Structured key space for all user-facing strings. */
export interface LocaleMap {
  // -- stdin / input area --
  'stdin.interactive.hint': string;
  'stdin.once.hint': string;
  'stdin.interactive.placeholder': string;
  'stdin.firstPromptPlaceholder': string;
  'stdin.label.input': string;
  'stdin.label.dynamic': string;
  'stdin.truncated': string;
  'stdin.insufficient.body': string;

  // -- output area --
  'output.truncated': string;

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
  'ui.queued': string;
  'ui.queuedLong': string;
  'ui.runningLong': string;
  'ui.runningLongLoop': string;
  'ui.runningLongNoStop': string;
  'ui.runningLongLoopNoStop': string;

  // -- settings tab --
  'settings.language.name': string;
  'settings.language.desc': string;
  'settings.language.auto': string;
  'settings.general': string;
  'settings.runtime': string;
  'settings.experimental': string;
  'settings.pythonCdn.name': string;
  'settings.pythonCdn.desc': string;
  'settings.ioPrompts.name': string;
  'settings.ioPrompts.desc': string;
  'settings.autoComplete.name': string;
  'settings.autoComplete.desc': string;
  'settings.autoSkeleton.name': string;
  'settings.autoSkeleton.desc': string;
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
  'python.aborted': string;
  'python.abortedReload': string;
  'python.loading': string;
  'python.loadTimeout': string;

  // -- network failures (remote languages + CDN-loaded runtimes) --
  'net.unknownHost': string;
  'net.offline': string;
  'net.failed': string;
  'net.timeout': string;
  'net.http': string;
  'net.badLibrary': string;

  // -- sololearn diagnostics --
  'diag.defaultLabel': string;
  'diag.errorCount': string;
  'diag.warningCount': string;

  // -- automatic snippet completion --
  'skeleton.notice': string;

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': string;
  'api.stdinUnavailable': string;
}
