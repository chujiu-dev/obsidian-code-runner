import type { LocaleMap } from './types';

const en: LocaleMap = {
  // -- stdin / input area --
  'stdin.interactive.hint': 'This program uses interactive input. Each line feeds one input() call in order.',
  'stdin.once.hint': 'Input is handed to the program before it runs — these languages cannot be prompted while running. One value per line.',
  'stdin.interactive.placeholder': 'Each line = one input() call.\nExample — a 3-line pre-fill for a program that reads name, age, city:\nAlice\n25\nNew York',
  'stdin.firstPromptPlaceholder': 'Enter input for first prompt…',
  'stdin.label.input': 'Input #{n}',
  'stdin.label.dynamic': 'Input #{n} (dynamic)',
  'stdin.truncated': '⚠️ Input truncated to {n} bytes.',
  'stdin.insufficient.body': 'Insufficient stdin! {label} lacks pre-filled data.\nConsumed {consumed} pre-filled lines, program continues requesting input (10 consecutive empty returns).\nPlease add more lines and re-run.',

  // -- output area --
  'output.truncated': '⚠️ Output too long — the first {n} lines were omitted; showing the last {max}.',

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
  'ui.queued': 'Waiting for another block to finish ({n} ahead)…',
  'ui.queuedLong': 'Waited {n}s to start. The block ahead may be stuck — you can press its "{stop}" button to abort it.',
  'ui.runningLong': 'Still running after {n}s — this program takes a while. Press "{stop}" if you need to stop it.',
  'ui.runningLongLoop': 'Still running after {n}s, and the code looks like an endless loop — press "{stop}" to abort it.',
  'ui.runningLongNoStop': 'Still running after {n}s — this program takes a while. This language cannot be stopped mid-run; if nothing comes back, check your network or try again later.',
  'ui.runningLongLoopNoStop': 'Still running after {n}s, and the code looks like an endless loop. This language cannot be stopped mid-run — wait for it to finish, or close the block.',

  // -- settings tab --
  'settings.language.name': 'Plugin language',
  'settings.language.desc': 'Select the display language for the Code Runner interface.',
  'settings.language.auto': 'Follow Obsidian',
  'settings.general': 'General',
  'settings.runtime': 'Runtime',
  'settings.experimental': 'Experimental',
  'settings.pythonCdn.name': 'Pyodide CDN',
  'settings.pythonCdn.desc': 'Base URL for loading Pyodide (Python WebAssembly runtime). Change this if you want to use a mirror or a self-hosted instance.',
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
  'python.aborted': 'Stopped.',
  'python.abortedReload': 'Stopped. The program ignored the interrupt, so the Python runtime was restarted — the next run reloads it.',
  'python.loading': 'Loading the Python runtime (downloads ~10 MB on first use)…',
  'python.loadTimeout': 'The Python runtime did not finish loading within 60 seconds. Check your network, or set a different Pyodide CDN in the plugin settings and run again.',

  // -- network failures (remote languages + CDN-loaded runtimes) --
  'net.unknownHost': 'the service',
  'net.offline': 'There is no network connection, so {host} cannot be reached. This language needs a connection — reconnect and run it again.',
  'net.failed': 'Could not reach {host}. Check your network or proxy settings and try again.',
  'net.timeout': '{host} did not respond within {n} seconds. Check your network and try again.',
  'net.http': '{host} returned an error (HTTP {status}). Try again later.',
  'net.badLibrary': 'The {lib} library downloaded from {host} loaded, but it does not offer the function this plugin needs — the file served by the CDN may have changed shape. Try again later.',

  // -- sololearn diagnostics --
  'diag.defaultLabel': 'diagnostic',
  'diag.errorCount': '{n} error{s}',
  'diag.warningCount': '{n} warning{s}',

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': 'Unsupported language: {lang}. Supported: {list}',
  'api.stdinUnavailable': 'Interactive input is not available when running through the API — the program was stopped.',
};

export default en;
