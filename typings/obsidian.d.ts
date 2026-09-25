// Patches for the parts of Obsidian's API this plugin uses that the shipped
// `obsidian.d.ts` does not declare (they are undocumented, or they exist only in
// the app). `skipLibCheck` in tsconfig.json keeps these patches from having to
// satisfy the interfaces they extend. The `EventRef` import is what `no-undef`
// asks for: this file is a module, so the name has to come from somewhere.
import type { EventRef } from 'obsidian';

declare module 'obsidian' {

  export interface DataAdapter {
    getBasePath(): string;
    getFullPath(path: string): string;
    startWatchPath(path: string): void;
    stopWatchPath(path: string): void;
  }

  export interface PluginSettingTab {
    name: string;
  }

  export interface App {
    readonly loadProgress: { show(): void; hide(): void; setMessage(msg: string): void; };
    plugins: {
      enablePlugin(id: string): Promise<void>;
      disablePlugin(id: string): Promise<void>;
    }
  }

  export interface Vault {
    config: {
      attachmentFolderPath: string
    }
    on(name: 'raw', callback: (file: string) => void, ctx?: unknown): EventRef;
  }
}
