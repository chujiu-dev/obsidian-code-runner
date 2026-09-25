import { PluginSettingTab, type Plugin } from 'obsidian';
import { Component as SolidComponent } from 'solid-js';
import { render } from 'solid-js/web';


export class PluginSolidSettingTab<C extends SolidComponent, P extends Plugin> extends PluginSettingTab {
  cleanup?: () => void;
  constructor(
    plugin: P,
    private readonly component: C,
    private readonly props: Parameters<C>[0]) {
    super(plugin.app, plugin);
  }
  display() {
    this.cleanup = render(() => this.component(this.props), this.containerEl);
  }
  hide() {
    this.cleanup?.();
  }
}
