import type { LocaleMap } from './types';

const en: LocaleMap = {
  // -- stdin / input area --
  'stdin.unsupported': 'This program requires stdin input which is currently only supported for Python.',
  'stdin.interactive.hint': 'This program uses interactive input. Each line feeds one input() call in order.',
  'stdin.interactive.placeholder': "Each line = one input() call.\nExample — a 3-line pre-fill for a program that reads name, age, city:\nAlice\n25\nNew York",
  'stdin.firstPromptPlaceholder': 'Enter input for first prompt…',
  'stdin.label.input': 'Input #{n}',
  'stdin.label.dynamic': 'Input #{n} (dynamic)',
  'stdin.insufficient.worker': '⚠️ Insufficient stdin! Exhausted all {lines} pre-filled lines.\nProgram continues requesting input (10 consecutive empty returns).\nPlease add more lines and re-run.',
  'stdin.insufficient.body': 'Insufficient stdin! {label} lacks pre-filled data.\nConsumed {consumed} pre-filled lines, program continues requesting input (10 consecutive empty returns).\nPlease add more lines and re-run.',

  // -- UI chrome --
  'ui.run': 'Run (Enter)',
  'ui.play': 'play',
  'ui.closeInput': 'Close input',
  'ui.cancelStdin': 'Cancel (send empty input)',
  'ui.submit': 'Submit (Enter)',
  'ui.stop': 'Stop',
  'ui.clearOutput': 'Clear output',
  'ui.toggleInput': 'Toggle input area',
  'ui.terminate': 'Terminate execution immediately',

  // -- settings tab --
  'settings.language.name': 'Plugin language',
  'settings.language.desc': 'Select the display language for the Code Runner interface.',
  'settings.language.auto': 'Follow Obsidian',
  'settings.comingSoon.heading': 'Coming Soon',
  'settings.ioPrompts.name': 'Context-Aware I/O Prompts',
  'settings.ioPrompts.desc': 'Display contextual hints in input and output areas. Shows the current input prompt during line-by-line entry, all pending prompts on mobile multi-line input, and output line guidance.',
  'settings.autoComplete.name': 'Code auto-complete',
  'settings.autoComplete.desc': 'Provide intelligent code completion suggestions while typing in code blocks.',
  'settings.additionalPlugins.heading': 'Additional Plugins',
  'settings.additionalPlugins.desc': 'More language backends and integrations are on the roadmap. Stay tuned.',

  // -- pyodide / worker --
  'worker.error': 'Worker error: {message}',
  'pyodide.loadError': 'Failed to load Pyodide: {message}',
  'pyodide.initError': 'Pyodide init failed: {message}',
  'pyodide.notInitialized': 'Pyodide not initialized',
  'pyodide.setupError': '[Setup Error] {message}',
  'pyodide.injectError': '[Setup Error] Failed to inject input replacement',
  'pyodide.genericError': '[Pyodide Error] {message}',

  // -- sololearn diagnostics --
  'diag.defaultLabel': 'diagnostic',
  'diag.errorCount': '{n} error{s}',
  'diag.warningCount': '{n} warning{s}',

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': 'Unsupported language: {lang}. Supported: {list}',
};

export default en;
