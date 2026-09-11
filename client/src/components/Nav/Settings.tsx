import React, { useState, useRef, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { SettingsTabValues } from 'librechat-data-provider';
import { MessageSquare, Command, DollarSign, ChevronRight, ArrowLeft } from 'lucide-react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import {
  GearIcon,
  DataIcon,
  UserIcon,
  SpeechIcon,
  useMediaQuery,
  PersonalizationIcon,
} from '@librechat/client';
import type { TDialogProps } from '~/common';
import {
  General,
  Chat,
  Commands,
  Speech,
  Personalization,
  Data,
  Balance,
  Account,
} from './SettingsTabs';
import usePersonalizationAccess from '~/hooks/usePersonalizationAccess';
import { useLocalize, TranslationKeys } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { cn } from '~/utils';

type SettingsTab = {
  value: SettingsTabValues;
  icon: React.JSX.Element;
  label: TranslationKeys;
  content: React.ReactNode;
};

export default function Settings({ open, onOpenChange }: TDialogProps) {
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const { data: startupConfig } = useGetStartupConfig();
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState(SettingsTabValues.GENERAL);
  /**
   * On mobile the dialog uses a drill-down (master/detail) pattern: the category
   * list is shown first, and tapping a category swaps the panel to that section.
   * On desktop both are visible side by side and this flag is unused.
   */
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const tabRefs = useRef({});
  const { hasAnyPersonalizationFeature, hasMemoryOptOut } = usePersonalizationAccess();

  // Always reopen on the category list rather than the last-viewed section.
  useEffect(() => {
    if (!open) {
      setShowMobileDetail(false);
    }
  }, [open]);

  const settingsTabs: SettingsTab[] = [
    {
      value: SettingsTabValues.GENERAL,
      icon: <GearIcon />,
      label: 'com_nav_setting_general',
      content: <General />,
    },
    {
      value: SettingsTabValues.CHAT,
      icon: <MessageSquare className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_setting_chat',
      content: <Chat />,
    },
    {
      value: SettingsTabValues.COMMANDS,
      icon: <Command className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_commands',
      content: <Commands />,
    },
    {
      value: SettingsTabValues.SPEECH,
      icon: <SpeechIcon className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_setting_speech',
      content: <Speech />,
    },
    ...(hasAnyPersonalizationFeature
      ? [
          {
            value: SettingsTabValues.PERSONALIZATION,
            icon: <PersonalizationIcon />,
            label: 'com_nav_setting_personalization' as TranslationKeys,
            content: (
              <Personalization
                hasMemoryOptOut={hasMemoryOptOut}
                hasAnyPersonalizationFeature={hasAnyPersonalizationFeature}
              />
            ),
          },
        ]
      : ([] as SettingsTab[])),
    {
      value: SettingsTabValues.DATA,
      icon: <DataIcon />,
      label: 'com_nav_setting_data',
      content: <Data />,
    },
    ...(startupConfig?.balance?.enabled
      ? [
          {
            value: SettingsTabValues.BALANCE,
            icon: <DollarSign size={18} />,
            label: 'com_nav_setting_balance' as TranslationKeys,
            content: <Balance />,
          },
        ]
      : ([] as SettingsTab[])),
    {
      value: SettingsTabValues.ACCOUNT,
      icon: <UserIcon />,
      label: 'com_nav_setting_account',
      content: <Account />,
    },
  ];

  const activeTabMeta = settingsTabs.find((tab) => tab.value === activeTab) ?? settingsTabs[0];

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabs = settingsTabs.map((tab) => tab.value);
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
        break;
      case 'Home':
        event.preventDefault();
        setActiveTab(tabs[0]);
        break;
      case 'End':
        event.preventDefault();
        setActiveTab(tabs[tabs.length - 1]);
        break;
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as SettingsTabValues);
  };

  const showBack = isSmallScreen && showMobileDetail;

  return (
    <Transition appear show={open}>
      <Dialog as="div" className="relative z-50" onClose={onOpenChange}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black opacity-50 dark:opacity-80" aria-hidden="true" />
        </TransitionChild>

        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className={cn('fixed inset-0 flex w-screen items-center justify-center p-2 sm:p-4')}>
            <DialogPanel
              className={cn(
                'flex w-full flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-dialog shadow-2xl backdrop-blur-2xl animate-in',
                'h-[85vh] md:h-[600px] md:max-h-[85vh] md:w-[720px]',
              )}
            >
              <DialogTitle
                className={cn(
                  'flex flex-shrink-0 items-center gap-2 border-b border-border-light py-3 text-left sm:py-4',
                  showBack ? 'pl-1.5 pr-2 sm:pl-4 sm:pr-6' : 'px-4 sm:px-6',
                )}
                as="div"
              >
                {showBack && (
                  <button
                    type="button"
                    aria-label={localize('com_ui_back')}
                    onClick={() => setShowMobileDetail(false)}
                    className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-primary transition-colors duration-200 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
                <h2 className="truncate text-base font-semibold leading-6 text-text-primary sm:text-lg">
                  {showBack ? localize(activeTabMeta.label) : localize('com_nav_settings')}
                </h2>
                <button
                  type="button"
                  aria-label={localize('com_ui_close_settings')}
                  className="ml-auto inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy"
                  onClick={() => onOpenChange(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <line x1="18" x2="6" y1="6" y2="18"></line>
                    <line x1="6" x2="18" y1="6" y2="18"></line>
                  </svg>
                  <span className="sr-only">{localize('com_ui_close_settings')}</span>
                </button>
              </DialogTitle>

              {isSmallScreen ? (
                showMobileDetail ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    {activeTabMeta.content}
                  </div>
                ) : (
                  <nav
                    aria-label={localize('com_nav_settings')}
                    className="min-h-0 flex-1 overflow-y-auto p-2"
                  >
                    {settingsTabs.map(({ value, icon, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setActiveTab(value);
                          setShowMobileDetail(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy active:bg-surface-tertiary"
                      >
                        <span className="flex flex-shrink-0 items-center justify-center text-text-secondary">
                          {icon}
                        </span>
                        <span className="flex-1 truncate">{localize(label)}</span>
                        <ChevronRight
                          className="h-4 w-4 flex-shrink-0 text-text-secondary"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </nav>
                )
              ) : (
                <Tabs.Root
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="flex min-h-0 flex-1 flex-row"
                  orientation="vertical"
                >
                  <Tabs.List
                    aria-label="Settings"
                    className="flex w-56 flex-shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-light p-3"
                    onKeyDown={handleKeyDown}
                  >
                    {settingsTabs.map(({ value, icon, label }) => (
                      <Tabs.Trigger
                        key={value}
                        className={cn(
                          'group relative flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out',
                          'text-text-secondary hover:bg-gray-500/10 hover:text-text-primary',
                          'dark:hover:bg-gray-400/10',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy',
                          'radix-state-active:bg-gray-500/15 radix-state-active:text-text-primary',
                          'dark:radix-state-active:bg-gray-400/15 dark:radix-state-active:text-gray-200',
                        )}
                        value={value}
                        ref={(el) => (tabRefs.current[value] = el)}
                      >
                        <span className="flex flex-shrink-0 items-center justify-center">
                          {icon}
                        </span>
                        {localize(label)}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {settingsTabs.map(({ value, content }) => (
                      <Tabs.Content key={value} value={value} tabIndex={-1}>
                        {content}
                      </Tabs.Content>
                    ))}
                  </div>
                </Tabs.Root>
              )}
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
