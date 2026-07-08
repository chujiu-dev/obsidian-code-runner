import type { PluginSetting } from '../setting';
import type { SetStoreFunction } from 'solid-js/store';


export default (props: { settings: PluginSetting, settingsUpdate: SetStoreFunction<PluginSetting> } ) => {

  return <>
    {/* ── Coming Soon ── */}
    <div class="setting-item-heading" style="border-top: 1px solid var(--background-modifier-border); margin-top: 1em; padding-top: 1em;">
      <div class="setting-item-name" style="color: var(--text-muted); font-size: 0.85em;">Coming Soon</div>
    </div>

    <div class="setting-item mod-toggle">
      <div class="setting-item-info">
        <div class="setting-item-name">Auto stdin detect</div>
        <div class="setting-item-description">Automatically expand the input area when code contains stdin-reading calls such as input(), scanf(), or std::cin — no need to click the keyboard toggle. This feature is under development and will ship in a future update.</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container" classList={ { 'is-enabled': props.settings.autoStdin }}  onClick={() => props.settingsUpdate('autoStdin', (v) => !v)}>
          <input type="checkbox" checked={props.settings.autoStdin} disabled />
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Plugin language</div>
        <div class="setting-item-description">Switch the plugin interface language. Planned for a future release; English is the default for now.</div>
      </div>
      <div class="setting-item-control">
        <select class="dropdown" disabled style="opacity: 0.5;">
          <option value="en" selected={props.settings.language === 'en'}>English</option>
          <option value="zh" selected={props.settings.language === 'zh'}>简体中文</option>
        </select>
      </div>
    </div>

    {/* ── Additional Plugins — Coming Soon ── */}
    <div class="setting-item-heading" style="border-top: 1px solid var(--background-modifier-border); margin-top: 1em; padding-top: 1em;">
      <div class="setting-item-name" style="color: var(--text-muted); font-size: 0.85em;">Additional Plugins — Coming Soon</div>
    </div>

    <div class="setting-item mod-toggle">
      <div class="setting-item-info">
        <div class="setting-item-name">Code auto-complete</div>
        <div class="setting-item-description">Context-aware code completions that suggest variables, functions, and snippets as you type. Planned as a standalone companion plugin that pairs with Code Runner.</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container">
          <input type="checkbox" checked={false} disabled />
        </div>
      </div>
    </div>

    <div class="setting-item mod-toggle">
      <div class="setting-item-info">
        <div class="setting-item-name">Enhanced syntax highlighting</div>
        <div class="setting-item-description">Semantic-level highlighting beyond block-level coloring, leveraging Code Runner's language backends for accurate token coloring. Planned as a standalone companion plugin that pairs with Code Runner.</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container">
          <input type="checkbox" checked={false} disabled />
        </div>
      </div>
    </div>
  </>;
};
