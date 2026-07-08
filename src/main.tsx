import './style.css';
import { Plugin, type App, type PluginManifest } from 'obsidian';
import { createStore, unwrap, type Store, type SetStoreFunction  } from 'solid-js/store';
import { render } from 'solid-js/web';
import { PluginSolidSettingTab } from './solidify';
import backend, { type Stdio } from './backend';
import SettingTab from './components/SettingTab';
import CodeBlock from './components/CodeBlock';
import { needsStdin, supportsStdin } from './backend/stdin-detect';

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

export default class CodeEmitterPlugin extends Plugin {
  readonly settings: Store<PluginSetting>;
  readonly settingsUpdate: SetStoreFunction<PluginSetting>;

  /** Public API for other plugins to consume. */
  readonly api: CodeRunnerAPI = {
    getSupportedLanguages: () =>
      Object.keys(backend).filter(l => !l.includes('+') && !l.includes('#')),

    supportsStdin: (lang: string) => supportsStdin(lang),

    needsStdin: (lang: string, code: string) => needsStdin(lang, code),

    execute: async (lang: string, code: string, stdin?: string): Promise<string[]> => {
      const engine = backend[lang];
      if (!engine) {
        throw new Error(`Unsupported language: ${lang}. Supported: ${Object.keys(backend).filter(l => !l.includes('+') && !l.includes('#')).join(', ')}`);
      }

      const outputs: string[] = [];
      const stdio: Stdio = {
        subscribe: (sub) => { /* no-op for programmatic use */ return () => {}; },
        write: (...data) => { outputs.push(data.join(',')); },
        stdout: (...data) => { outputs.push(data.join(',')); },
        stderr: (...data) => { outputs.push(data.join(',')); },
        viewEl: document.createElement('div'),
        clear: () => { outputs.length = 0; },
        update: (fn) => { /* no-op */ },
        set: (v) => { outputs.splice(0, outputs.length, ...(v as unknown as string[])); },
        setStdin: () => {},
        getStdin: () => stdin ?? '',
      };

      await engine(code, stdio);
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
    // Platform.isDesktop && window.hmr && window.hmr(this, 2000);

    await this.loadSettings();

    this.addSettingTab(new PluginSolidSettingTab(
      this,
      SettingTab,
      {
        settings: this.settings,
        settingsUpdate: this.settingsUpdate,
      }
    ));

    Object.keys(backend).forEach(lang => {
      if (lang.includes('+') || lang.includes('#')) {
        return;
      }
      this.registerMarkdownCodeBlockProcessor(lang, async (source, el, ctx) => {
        render(() => <CodeBlock
          lang={lang}
          code={source}
          sourcePath={ctx.sourcePath} />,
        el);
      }, -1);
    });
  }

  async unload() {
    await this.saveSettings();
    super.unload();
  }

  async loadSettings(): Promise<void> {
    this.settingsUpdate(Object.assign({}, SETTING_DEFAULT, await this.loadData()));
  }
  async saveSettings(): Promise<void> {
    await this.saveData(unwrap(this.settings));
  }
}

