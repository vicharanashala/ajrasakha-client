import { ThemeSelector } from '@librechat/client';
import { BadgeCheck, Languages, Mic } from 'lucide-react';
import { cn } from '~/utils';
import { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';
import { useCallback, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { LangSelector } from '../Nav/SettingsTabs/General/General';
import { LanguageOption } from '~/common';
import Cookies from 'js-cookie';
import { useRecoilState } from 'recoil';
import store from '~/store';

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();
  /** Login and registration are where someone may not know the product yet; a password-reset
   *  screen does not need the pitch. */
  const isEntryScreen = pathname.includes('login') || pathname.includes('register');
  /** What the brand panel says the product does. Titles reuse the capability chips from the
   *  landing screen; each carries a line of its own so the panel explains the product rather
   *  than listing three words. */
  const brandPoints = [
    {
      Icon: BadgeCheck,
      titleKey: 'com_ui_landing_chip_expert_verified',
      descriptionKey: 'com_auth_panel_expert_verified_description',
    },
    {
      Icon: Mic,
      titleKey: 'com_ui_landing_chip_voice',
      descriptionKey: 'com_auth_panel_voice_description',
    },
    {
      Icon: Languages,
      titleKey: 'com_ui_landing_chip_multilingual',
      descriptionKey: 'com_auth_panel_multilingual_description',
    },
  ] as const;

  const [isLangOpen, setIsLangOpen] = useState(() => {
    return !localStorage.getItem('lang_selected');
  });
  /** True when the dialog was opened from the footer rather than automatically on a first
   *  visit. Dismissing a first-visit prompt falls back to the browser language; dismissing a
   *  deliberate visit must leave the current choice alone. */
  const [isLangOpenedManually, setIsLangOpenedManually] = useState(false);

  const [langcode, setLangcode] = useRecoilState(store.lang);



  const handleLangChange = useCallback(
    (value: string) => {
      let userLang = value;
      if (value === 'auto') {
        userLang =
          (typeof navigator !== 'undefined'
            ? navigator.language || navigator.languages?.[0]
            : null) ?? 'en-US';
      }

      requestAnimationFrame(() => {
        document.documentElement.lang = userLang;
      });

      setLangcode(userLang);
      localStorage.setItem('lang_selected', 'true');
      setIsLangOpen(false);
      Cookies.set('lang', userLang, { expires: 365 });
    },
    [setLangcode],
  );

  /** Dismissing the first-visit prompt falls back to the browser language, since no choice
   *  has been made yet. Dismissing a dialog the user opened themselves must leave their
   *  current language untouched. */
  const closeLangDialog = useCallback(() => {
    if (!isLangOpenedManually) {
      handleLangChange('auto');
    }
    setIsLangOpenedManually(false);
    setIsLangOpen(false);
  }, [handleLangChange, isLangOpenedManually]);

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a className="font-semibold text-green-600 hover:underline" href="/forgot-password">
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    } else if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-white dark:bg-gray-900 supports-[min-height:100svh]:min-h-svh">
      {/* Decorative brand wash falling from the top of the page, matching the one behind the
          chat column, so signing in looks like the same product. First in the DOM and
          negatively stacked so every later sibling paints over it without its own z-index.

          From sm only. Below that the card has no frame and fills the width, so an opaque
          card over a tinted page reads as a seam rather than as elevation — and the floating
          labels punch opaque chips that cannot match a gradient behind them either. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-72 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(25,135,84,0.13),transparent_72%)] dark:bg-[radial-gradient(120%_100%_at_50%_0%,rgba(117,215,178,0.09),transparent_72%)] sm:block"
      />
      <Transition appear show={isLangOpen}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={closeLangDialog}
        >
          {' '}
          {/* Backdrop */}
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 dark:bg-black/70" />
          </TransitionChild>
          {/* Panel */}
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <DialogPanel className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
                <DialogTitle as="div" className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Select Language
                  </h2>

                  <button
                    onClick={closeLangDialog}
                    className="rounded-md p-1 text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </DialogTitle>

                <LangSelector
                  langcode={langcode}
                  onChange={handleLangChange}
                  portal={false}
                />
              </DialogPanel>
            </div>
          </TransitionChild>
        </Dialog>
      </Transition>

      {/* In-development notice. The Banner component still renders, but its copy was
          commented out when that notice moved to the chat Footer — and the auth screens have
          no composer for it to sit under, so they carry it here instead. Same string the
          important-notice modal uses, so there is nothing new to translate. */}
      <div
        role="status"
        className="w-full bg-black/[0.04] px-4 py-3 text-center text-sm font-medium text-text-primary dark:bg-white/[0.06] sm:text-base"
      >
        {localize('com_ui_important_notice_p1')}
      </div>
      <Banner />
      <DisplayError />
      {/* Theme and language sit together: both are things a first-time visitor may need to
          set before they can read the form at all. Pinned to the corner from md up, where
          there is room for it. On a phone it would sit on top of the footer links, so below
          md it joins the flex column as its last row instead. */}
      <div
        className={cn(
          'order-last flex items-center justify-start gap-1 px-4 pb-2',
          'md:absolute md:bottom-0 md:left-0 md:m-2 md:justify-start md:pb-0',
        )}
      >
        <ThemeSelector returnThemeOnly />
        {/* An icon button rather than the labelled dropdown, so it reads as a pair with the
            theme toggle beside it. It opens the language dialog this layout already renders
            on a first visit — a better picker on a phone than a footer dropdown. */}
        <button
          type="button"
          onClick={() => {
            setIsLangOpenedManually(true);
            setIsLangOpen(true);
          }}
          aria-label={localize('com_nav_language')}
          title={localize('com_nav_language')}
          className={cn(
            // Mirrors ThemeSelector's own button: same padding, radius and hover.
            'flex items-center rounded-lg p-2 text-text-primary transition-colors',
            'hover:bg-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
            'focus-visible:ring-offset-2 dark:focus-visible:ring-0',
          )}
        >
          <Languages className="size-5" aria-hidden="true" />
        </button>
      </div>

      <main className="flex flex-grow items-center justify-center px-4 py-6 sm:py-8">
        <div
          className={cn(
            'w-full sm:max-w-md',
            // From lg the brand panel and the form sit side by side in one frame, so the
            // wrapper owns the border and shadow and the card drops its own. Below lg this
            // wrapper is inert and the card is the whole layout.
            'lg:flex lg:w-full lg:max-w-4xl lg:overflow-hidden lg:rounded-3xl',
            'lg:border lg:border-border-light dark:lg:border-white/10',
            'lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04),0_18px_44px_0_rgba(0,0,0,0.08)] dark:lg:shadow-none',
          )}
        >
          {/* Brand panel — desktop only. Phones get the card alone. The wordmark is pinned
              to the top and the message owns the centre, so the panel has a reading order
              rather than being one evenly spaced stack. */}
          <aside
            className={cn(
              'hidden lg:flex lg:w-[44%] lg:shrink-0 lg:flex-col lg:p-10',
              'lg:bg-[linear-gradient(160deg,#198754,#0f5c3a)] lg:text-white',
            )}
          >
            {/* The wordmark's type is dark green, which all but disappears on this panel,
                so the whole lockup is knocked out to white. Sized by width, since it is a
                wide lockup rather than a square mark. */}
            <img
              src="assets/annam.png"
              alt=""
              aria-hidden="true"
              className="h-auto w-40 object-contain brightness-0 invert"
            />
            <div className="flex flex-1 flex-col justify-center gap-7 py-10">
              <h2 className="max-w-[18rem] text-2xl font-semibold leading-snug">
                {localize('com_ui_landing_tagline')}
              </h2>
              <ul className="flex flex-col gap-5">
                {brandPoints.map(({ Icon, titleKey, descriptionKey }) => (
                  <li key={titleKey} className="flex gap-3.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{localize(titleKey)}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                        {localize(descriptionKey)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div
            className={cn(
              'bg-white px-1 py-2 dark:bg-gray-900',
              // A real container from sm up, so the form has edges instead of floating on
              // the page. Phones get the form full-width with no frame to pay for.
              'sm:rounded-2xl sm:border sm:border-border-light sm:px-7 sm:py-7 dark:sm:border-white/10',
              'sm:shadow-[0_1px_2px_0_rgba(0,0,0,0.04),0_12px_32px_0_rgba(0,0,0,0.06)] dark:sm:shadow-none',
              'lg:flex-1 lg:rounded-none lg:border-0 lg:px-10 lg:py-12 lg:shadow-none',
            )}
          >
            <div className="mb-5 flex flex-col items-center gap-2.5 sm:mb-6 sm:gap-3 lg:items-start">
              <div className="flex items-center gap-3">
                {/* Blinks while the startup config loads — the cue the page-top strip used
                    to carry. */}
                <BlinkAnimation active={isFetching}>
                  <img
                    src="assets/annam-logo.png"
                    className="size-9 shrink-0 object-contain sm:size-10"
                    alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'LibreChat' })}
                  />
                </BlinkAnimation>
                {!hasStartupConfigError && !isFetching && header && (
                  <h1
                    className="text-2xl font-semibold text-text-primary sm:text-3xl"
                    style={{ userSelect: 'none' }}
                  >
                    {header}
                  </h1>
                )}
              </div>
              {isEntryScreen && (
                <p className="text-balance text-center text-sm text-text-secondary lg:hidden">
                  {localize('com_ui_landing_tagline')}
                </p>
              )}
            </div>
            {children}
            {!pathname.includes('2fa') && isEntryScreen && (
              <SocialLoginRender startupConfig={startupConfig} />
            )}
          </div>
        </div>
      </main>
      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
