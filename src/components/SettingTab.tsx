import type { PluginSetting } from '../setting';
import type { SetStoreFunction } from 'solid-js/store';
import type { LanguageSetting } from '../i18n/types';
import { t, setLanguageSetting } from '../i18n';


/** Reusable category heading — muted, bold, with top margin. */
function SectionHeading(props: { label: string }) {
  return (
    <div class="setting-item setting-item-heading" style="margin-top: 1.5em;">
      <div class="setting-item-info">
        <div class="setting-item-name" style="color: var(--text-muted); font-weight: 600;">
          {props.label}
        </div>
      </div>
    </div>
  );
}

/** Reusable disabled checkbox row for planned features. */
function ComingSoonItem(props: { name: string; desc: string }) {
  return (
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{props.name}</div>
        <div class="setting-item-description">{props.desc}</div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container" style="opacity: 0.4; pointer-events: none;">
          <input type="checkbox" disabled />
          <span class="checkbox-tick"></span>
        </div>
      </div>
    </div>
  );
}


export default (props: {
  settings: PluginSetting,
  settingsUpdate: SetStoreFunction<PluginSetting>,
  save: () => void,
}) => {

  // Migrate legacy 'zh' setting → 'auto' (manual Chinese option removed; auto-detection still covers zh)
  const langValue = () => props.settings.language === 'zh' ? 'auto' : props.settings.language;

  return <>
    {/* ═══ General ═══ */}
    <SectionHeading label={t('settings.general')} />

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

    {/* ═══ Runtime ═══ */}
    <SectionHeading label={t('settings.runtime')} />

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('settings.pythonCdn.name')}</div>
        <div class="setting-item-description">{t('settings.pythonCdn.desc')}</div>
      </div>
      <div class="setting-item-control">
        <input
          type="text"
          spellcheck={false}
          value={props.settings.python.cdn}
          onBlur={(e) => {
            props.settingsUpdate('python', 'cdn', e.target.value);
            props.save();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              props.settingsUpdate('python', 'cdn', (e.target as HTMLInputElement).value);
              props.save();
            }
          }}
        />
      </div>
    </div>

    {/* ═══ Experimental ═══ */}
    <SectionHeading label={t('settings.experimental')} />

    <ComingSoonItem
      name={t('settings.ioPrompts.name')}
      desc={t('settings.ioPrompts.desc')}
    />

    <ComingSoonItem
      name={t('settings.autoComplete.name')}
      desc={t('settings.autoComplete.desc')}
    />

    {/* Additional Plugins — description only, no toggle */}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">{t('settings.additionalPlugins.heading')}</div>
        <div class="setting-item-description">{t('settings.additionalPlugins.desc')}</div>
      </div>
    </div>
  </>;
};
