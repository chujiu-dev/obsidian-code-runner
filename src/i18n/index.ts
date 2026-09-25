import { createSignal } from 'solid-js';
import { getLanguage, requireApiVersion } from 'obsidian';
import type { LanguageSetting, ResolvedLanguage, LocaleMap } from './types';
import en from './en';
import zh from './zh';

const locales: Record<ResolvedLanguage, LocaleMap> = { en, zh };

const [languageSetting, setLanguageSettingRaw] = createSignal<LanguageSetting>('auto');

/**
 * Resolve 'auto' to the actually detected Obsidian language.
 *
 * `getLanguage` arrived in Obsidian 1.8.7 and the manifest still supports
 * 0.12.0, so the call is behind `requireApiVersion` — the guard the community
 * review asks for, and the one that keeps older apps on the `en` default
 * instead of on a missing function. The `try` stays as the second line of
 * defence: a locale that is not a string is not worth failing a load over.
 */
function detectObsidianLanguage(): ResolvedLanguage {
  try {
    const lang = requireApiVersion('1.8.7') ? getLanguage() : undefined;
    if (lang && (lang === 'zh' || lang.startsWith('zh-'))) return 'zh';
  } catch {
    // getLanguage() may not be available in older Obsidian versions
  }
  return 'en';
}

/** The currently effective language (resolved from 'auto'). */
function resolvedLanguage(): ResolvedLanguage {
  const setting = languageSetting();
  if (setting === 'auto') return detectObsidianLanguage();
  return setting;
}

/**
 * Translate a key into the current language.
 *
 * In SolidJS reactive contexts (components, createMemo, etc.), calling this
 * function auto-subscribes to language changes. In non-reactive contexts,
 * it returns the current snapshot value.
 */
export function t(key: keyof LocaleMap, params?: Record<string, string | number>): string {
  const lang = resolvedLanguage();
  const map = locales[lang];
  let value: string | undefined = map[key];
  if (value === undefined) {
    // Fallback to English
    value = locales.en[key];
    if (value === undefined) {
      console.warn(`[Code Runner] Missing translation key: ${key}`);
      return key;
    }
  }
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, k: string) =>
      String(params[k] ?? `{${k}}`)
    );
  }
  return value;
}

/** Get the current language setting value (includes 'auto'). */
export function getLanguageSetting(): LanguageSetting {
  return languageSetting();
}

/** Set the language setting (reactive). */
export function setLanguageSetting(lang: LanguageSetting): void {
  setLanguageSettingRaw(lang);
}

/** Initialize with a stored setting. Call once on plugin load. */
export function initI18n(storedLang: LanguageSetting): void {
  setLanguageSettingRaw(storedLang);
}
