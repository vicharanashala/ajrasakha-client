import React, { useContext, useCallback, useState } from 'react';
import Cookies from 'js-cookie';
import { Check, Search } from 'lucide-react';
import { useRecoilState } from 'recoil';
import { Dropdown, ThemeContext } from '@librechat/client';
import ArchivedChats from './ArchivedChats';
import ToggleSwitch from '../ToggleSwitch';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { LanguageOption } from '~/common';

const toggleSwitchConfigs = [
  {
    stateAtom: store.enableUserMsgMarkdown,
    localizationKey: 'com_nav_user_msg_markdown',
    switchId: 'enableUserMsgMarkdown',
    hoverCardText: undefined,
    key: 'enableUserMsgMarkdown',
  },
  {
    stateAtom: store.autoScroll,
    localizationKey: 'com_nav_auto_scroll',
    switchId: 'autoScroll',
    hoverCardText: undefined,
    key: 'autoScroll',
  },
  {
    stateAtom: store.hideSidePanel,
    localizationKey: 'com_nav_hide_panel',
    switchId: 'hideSidePanel',
    hoverCardText: undefined,
    key: 'hideSidePanel',
  },
  {
    stateAtom: store.keepScreenAwake,
    localizationKey: 'com_nav_keep_screen_awake',
    switchId: 'keepScreenAwake',
    hoverCardText: undefined,
    key: 'keepScreenAwake',
  },
];

export const ThemeSelector = ({
  theme,
  onChange,
  portal = true,
}: {
  theme: string;
  onChange: (value: string) => void;
  portal?: boolean;
}) => {
  const localize = useLocalize();

  const themeOptions = [
    { value: 'system', label: localize('com_nav_theme_system') },
    { value: 'dark', label: localize('com_nav_theme_dark') },
    { value: 'light', label: localize('com_nav_theme_light') },
  ];

  const labelId = 'theme-selector-label';

  return (
    <div className="flex items-center justify-between">
      <div id={labelId}>{localize('com_nav_theme')}</div>

      <Dropdown
        value={theme}
        onChange={onChange}
        options={themeOptions}
        sizeClasses="w-[180px]"
        testId="theme-selector"
        className="z-50"
        aria-labelledby={labelId}
        portal={portal}
      />
    </div>
  );
};

export const LangSelector = ({
  langcode,
  onChange,
  portal = true,
  defaultLanguageOptions,
  compactOnMobile = false,
  required = false,
  inline = false,
}: {
  langcode: string;
  onChange: (value: string) => void;
  portal?: boolean;
  defaultLanguageOptions?: LanguageOption[];
  /**
   * When true, hides the redundant "Language" caption on mobile (the dropdown
   * button already shows the selected language) and tightens its padding/text
   * size there. Pure CSS — the dropdown itself never changes shape or logic
   * at any breakpoint. Defaults to false so existing callers are unaffected.
   */
  compactOnMobile?: boolean;
  /** When true, appends a small red asterisk to the caption to mark this field as required. */
  required?: boolean;
  /** When true, shows the languages as a scrollable list instead of a dropdown (used in the login language dialog). */
  inline?: boolean;
}) => {
  const localize = useLocalize();
  // Search text for the inline language list.
  const [languageQuery, setLanguageQuery] = useState('');

  const languageOptions: LanguageOption[] = [
    { value: 'auto', label: localize('com_nav_lang_auto') },
    { value: 'en-US', label: localize('com_nav_lang_english') },
    { value: 'as-IN', label: localize('com_nav_lang_assamese') },
    { value: 'bn-IN', label: localize('com_nav_lang_bengali') },
    { value: 'gu-IN', label: localize('com_nav_lang_gujarati') },
    { value: 'hi-IN', label: localize('com_nav_lang_hindi') },
    { value: 'kn-IN', label: localize('com_nav_lang_kannada') },
    { value: 'ml-IN', label: localize('com_nav_lang_malayalam') },
    { value: 'mr-IN', label: localize('com_nav_lang_marathi') },
    { value: 'or-IN', label: localize('com_nav_lang_odia') },
    { value: 'pa', label: localize('com_nav_lang_punjabi') },
    { value: 'sa-IN', label: localize('com_nav_lang_sanskrit') },
    { value: 'ta-IN', label: localize('com_nav_lang_tamil') },
    { value: 'te-IN', label: localize('com_nav_lang_telugu') },
    { value: 'ur-IN', label: localize('com_nav_lang_urdu') },
    { value: 'as2-IN', label: localize('com_nav_lang_bodo') },
    { value: 'as3-IN', label: localize('com_nav_lang_dogri') },
    { value: 'ks-IN', label: localize('com_nav_lang_kashmiri') },
    { value: 'kok-IN', label: localize('com_nav_lang_konkani') },
    { value: 'mai-IN', label: localize('com_nav_lang_maithili') },
    { value: 'sat-IN', label: localize('com_nav_lang_santali') },
    { value: 'sd-IN', label: localize('com_nav_lang_sindhi') },
    { value: 'ne-IN', label: localize('com_nav_lang_nepali') },
    { value: 'mn-IN', label: localize('com_nav_lang_manipuri') },
  ];

  const labelId = 'language-selector-label';

  if (inline) {
    const allOptions = defaultLanguageOptions || languageOptions;
    const term = languageQuery.trim().toLowerCase();
    const visibleOptions = term
      ? allOptions.filter((o) => o.label.toLowerCase().includes(term))
      : allOptions;
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600 dark:border-gray-700 dark:bg-gray-800/50">
          <Search className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={languageQuery}
            onChange={(e) => setLanguageQuery(e.target.value)}
            placeholder="Search language"
            aria-label="Search language"
            autoComplete="off"
            className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 !shadow-none !outline-none !ring-0 focus:!outline-none focus-visible:!outline-none focus-visible:!ring-0 dark:text-gray-100"
          />
        </div>
        <ul
          role="listbox"
          aria-label={localize('com_nav_language')}
          className="grid max-h-[45vh] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          {visibleOptions.length === 0 && (
            <li className="col-span-full px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No languages found
            </li>
          )}
          {visibleOptions.map((option) => {
            const selected = option.value === langcode;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onChange(option.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                    selected
                      ? 'border-green-600/40 bg-green-600/10 font-medium text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && (
                    <Check
                      className="size-4 shrink-0 text-green-600 dark:text-green-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-gray-700 dark:text-gray-100">
      <div id={labelId} className={compactOnMobile ? 'hidden sm:block' : undefined}>
        {localize('com_nav_language')}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </div>

      <Dropdown
        value={langcode}
        onChange={onChange}
        sizeClasses="[--anchor-max-height:256px] max-h-[60vh]"
        options={defaultLanguageOptions || languageOptions}
        className={
          compactOnMobile ? 'z-50 px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm' : 'z-50'
        }
        aria-labelledby={labelId}
        ariaLabel={compactOnMobile ? localize('com_nav_language') : undefined}
        portal={portal}
      />
    </div>
  );
};

function General() {
  const { theme, setTheme } = useContext(ThemeContext);

  const [langcode, setLangcode] = useRecoilState(store.lang);

  const changeTheme = useCallback(
    (value: string) => {
      setTheme(value);
    },
    [setTheme],
  );

  const changeLang = useCallback(
    (value: string) => {
      let userLang = value;
      if (value === 'auto') {
        userLang = navigator.language || navigator.languages[0];
      }

      requestAnimationFrame(() => {
        document.documentElement.lang = userLang;
      });
      setLangcode(userLang);
      Cookies.set('lang', userLang, { expires: 365 });
    },
    [setLangcode],
  );

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <ThemeSelector theme={theme} onChange={changeTheme} />
      </div>
      <div className="pb-3">
        <LangSelector langcode={langcode} onChange={changeLang} />
      </div>
      {toggleSwitchConfigs.map((config) => (
        <div key={config.key} className="pb-3">
          <ToggleSwitch
            stateAtom={config.stateAtom}
            localizationKey={config.localizationKey}
            hoverCardText={config.hoverCardText}
            switchId={config.switchId}
          />
        </div>
      ))}
      <div className="pb-3">
        <ArchivedChats />
      </div>
    </div>
  );
}

export default React.memo(General);
