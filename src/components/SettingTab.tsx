import type { PluginSetting } from '../setting';
import type { SetStoreFunction } from 'solid-js/store';
import type { LanguageSetting } from '../i18n/types';
import { t, setLanguageSetting } from '../i18n';


export default (props: { settings: PluginSetting, settingsUpdate: SetStoreFunction<PluginSetting>, save: () => void } ) => {

  // Migrate legacy 'zh' setting → 'auto' (manual Chinese option removed; auto-detection still covers zh)
  const langValue = () => props.settings.language === 'zh' ? 'auto' : props.settings.language;

  return <>
    {/* ── Language ── */}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('settings.language.name')}</div>
        <div class="setting-item-description">{t('settings.language.desc')}</div>
      </div>
      <div class="setting-item-control">
        <select
          class="dropdown"
          value={langValue()}
          onChange={(e) => {
            const lang = e.target.value as LanguageSetting;
            setLanguageSetting(lang);
            props.settingsUpdate('language', lang);
            props.save();
          }}
        >
          <option value="auto">{t('settings.language.auto')}</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    {/* ── Coming Soon ── */}
    <div class="setting-item setting-item-heading" style="margin-top: 1.5em;">
      <div class="setting-item-info">
        <div class="setting-item-name" style="color: var(--text-muted); font-weight: 600;">
          {t('settings.comingSoon.heading')}
        </div>
      </div>
    </div>

    {/* Context-Aware I/O Prompts */}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('settings.ioPrompts.name')}</div>
        <div class="setting-item-description">{t('settings.ioPrompts.desc')}</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container" style="opacity: 0.4; pointer-events: none;">
          <input type="checkbox" disabled />
          <span class="checkbox-tick"></span>
        </div>
      </div>
    </div>

    {/* Code auto-complete */}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('settings.autoComplete.name')}</div>
        <div class="setting-item-description">{t('settings.autoComplete.desc')}</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container" style="opacity: 0.4; pointer-events: none;">
          <input type="checkbox" disabled />
          <span class="checkbox-tick"></span>
        </div>
      </div>
    </div>

    {/* ── Additional Plugins ── */}
    <div class="setting-item setting-item-heading" style="margin-top: 1.5em;">
      <div class="setting-item-info">
        <div class="setting-item-name" style="color: var(--text-muted); font-weight: 600;">
          {t('settings.additionalPlugins.heading')}
        </div>
        <div class="setting-item-description">{t('settings.additionalPlugins.desc')}</div>
      </div>
    </div>
  </>;
};
