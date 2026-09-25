import './style.css';
import { Plugin, type App, type PluginManifest } from 'obsidian';
import { createStore, unwrap, type Store, type SetStoreFunction  } from 'solid-js/store';
import { render } from 'solid-js/web';
import { PluginSolidSettingTab } from './solidify';
import backend, { createStdio } from './backend';
import { setPythonCdn, disposePython } from './backend/languages/python';
import { LANGUAGE_ALIASES, canonicalLang, isRegisterableTag } from './backend/languages/aliases';
import SettingTab from './components/SettingTab';
import CodeBlock from './components/CodeBlock';
import { needsStdin, supportsStdin } from './backend/stdin-detect';
import { initI18n, t } from './i18n';

import SETTING_DEFAULT, { type PluginSetting } from './setting';

/**
 * Public API exposed to other plugins via `app.plugins.plugins['code-runner'].api`.
 *
 * @example
 * ```ts
 * const cr = this.app.plugins.plugins['code-runner'];
 * const langs = cr.api.getSupportedLanguages();
 * if (cr.api.needsStdin('python', code)) { ... }
 * const output = await cr.api.execute('python', 'print(1+1)');
 * ```
 */
export interface CodeRunnerAPI {
  /** List all supported language identifiers. */
  getSupportedLanguages(): string[];
  /** Check whether a language supports stdin input. */
  supportsStdin(lang: string): boolean;
  /** Analyze source code to detect stdin-reading function calls. */
  needsStdin(lang: string, code: string): boolean;
  /** Execute code programmatically and return output lines. */
  execute(lang: string, code: string, stdin?: string): Promise<string[]>;
}

/**
 * Language tags exposed to users, one per language. The registry also holds
 * aliases (`javascript`, `haskell`, `R`, …) that work in code fences but are
 * not advertised here.
 */
function supportedLanguages(): string[] {
  const aliases = new Set(Object.keys(LANGUAGE_ALIASES));
  return Object.keys(backend).filter(l => !aliases.has(l));
}

export default class CodeEmitterPlugin extends Plugin {
  // Obsidian's Plugin declares `settings?: unknown` and asks subclasses to
  // declare a concrete type; `declare` keeps that from being re-emitted as a
  // class field that would shadow the base property.
  declare readonly settings: Store<PluginSetting>;
  readonly settingsUpdate: SetStoreFunction<PluginSetting>;

  /** Public API for other plugins to consume. */
  readonly api: CodeRunnerAPI = {
    getSupportedLanguages: () => supportedLanguages(),

    supportsStdin: (lang: string) => supportsStdin(lang),

    needsStdin: (lang: string, code: string) => needsStdin(lang, code),

    execute: async (lang: string, code: string, stdin?: string): Promise<string[]> => {
      const engine = backend[lang];
      if (!engine) {
        throw new Error(t('api.unsupportedLang', { lang, list: supportedLanguages().join(', ') }));
      }

      // A real Stdio (rather than a hand-rolled stand-in) keeps the output
      // stream, the view element and the interactive-stdin hooks consistent
      // with what the on-screen blocks use.
      const stdio = createStdio();
      const outputs: string[] = [];
      stdio.subscribe(lines => { outputs.splice(0, outputs.length, ...lines); });
      stdio.setStdin(stdin ?? '');

      // A programmatic run has nobody to prompt, so answer interactive requests
      // with empty lines. The reply must be deferred: requestStdin() notifies
      // subscribers before it installs the resolver provideStdin() needs.
      //
      // The count is capped because a program that loops on input() would
      // otherwise spin forever: it holds the Python runtime that every code
      // block shares, and empty answers arrive instantly, so there is no
      // natural timeout to end it.
      let answered = 0;
      const MAX_AUTO_INPUT = 3;
      stdio.onStdinRequest(() => {
        answered += 1;
        const givingUp = answered > MAX_AUTO_INPUT;
        if (givingUp) stdio.stderr(t('api.stdinUnavailable'));
        queueMicrotask(() => {
          stdio.provideStdin('');
          if (givingUp) engine.terminate?.(stdio);
        });
      });

      await engine(code, stdio);
      // Output reaches subscribers in batches, so a short program's last lines
      // (or all of them) may still be buffered. The caller gets the finished
      // array, so it has to be drained here rather than on the next tick.
      stdio.flush();
      return outputs;
    },
  };

  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    const [settings, settingsUpdate ] = createStore(SETTING_DEFAULT);
    this.settings = settings;
    this.settingsUpdate = settingsUpdate;
  }


  async onload() {
    await this.loadSettings();

    this.addSettingTab(new PluginSolidSettingTab(
      this,
      SettingTab,
      {
        settings: this.settings,
        settingsUpdate: this.settingsUpdate,
        save: () => this.saveSettings(),
        // Editing the CDN in the settings tab takes effect on the next run.
        onCdnChange: (cdn: string) => setPythonCdn(cdn),
      }
    ));

    // Every registry key, aliases included — not just the advertised names.
    // Registering `supportedLanguages()` left every alias fence (`py`,
    // `javascript`, `R`, …) unprocessed, i.e. rendered as a plain code block
    // with no run button, which reads as "the plugin does not know this
    // language". What reaches the component is the canonical tag, because the
    // view compares against canonical names (`props.lang === 'python'`), while
    // the registry keeps aliases as keys so execution works either way.
    //
    // The tag is also spliced into a CSS selector inside Obsidian
    // (`findAll("code.language-" + tag)`), so a tag that is not a valid CSS
    // identifier — `c++`, `c#` — throws there and breaks the rendering of every
    // note, not just that block. Those fences are left to Obsidian.
    Object.keys(backend).filter(isRegisterableTag).forEach(tag => {
      this.registerMarkdownCodeBlockProcessor(tag, async (source, el, ctx) => {
        render(() => <CodeBlock
          lang={canonicalLang(tag)}
          code={source}
          sourcePath={ctx.sourcePath} />,
        el);
      }, -1);
    });
  }

  unload(): void {
    this.saveSettings().catch(console.error);
    // Stops the Pyodide Worker; without this it keeps running after the plugin
    // is disabled or the app is reloaded.
    disposePython();
    super.unload();
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData() as Partial<PluginSetting> | null;

    // Nested objects are merged instead of replaced, so settings saved by an
    // older version don't drop defaults added since.
    const merged: PluginSetting = {
      ...SETTING_DEFAULT,
      ...(data ?? {}),
      python: { ...SETTING_DEFAULT.python, ...(data?.python ?? {}) },
    };

    this.settingsUpdate(merged);
    initI18n(merged.language);
    setPythonCdn(merged.python.cdn);
  }
  async saveSettings(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Obsidian's saveData accepts the SolidJS unwrapped store object
    await this.saveData(unwrap(this.settings));
  }
}

