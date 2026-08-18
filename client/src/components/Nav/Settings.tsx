import React, { useState, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { SettingsTabValues } from 'librechat-data-provider';
import { MessageSquare, Command, DollarSign } from 'lucide-react';
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

export default function Settings({ open, onOpenChange }: TDialogProps) {
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const { data: startupConfig } = useGetStartupConfig();
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState(SettingsTabValues.GENERAL);
  const tabRefs = useRef({});
  const { hasAnyPersonalizationFeature, hasMemoryOptOut } = usePersonalizationAccess();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabs: SettingsTabValues[] = [
      SettingsTabValues.GENERAL,
      SettingsTabValues.CHAT,
      SettingsTabValues.COMMANDS,
      SettingsTabValues.SPEECH,
      ...(hasAnyPersonalizationFeature ? [SettingsTabValues.PERSONALIZATION] : []),
      SettingsTabValues.DATA,
      ...(startupConfig?.balance?.enabled ? [SettingsTabValues.BALANCE] : []),
      SettingsTabValues.ACCOUNT,
    ];
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

  const settingsTabs: {
    value: SettingsTabValues;
    icon: React.JSX.Element;
    label: TranslationKeys;
  }[] = [
    {
      value: SettingsTabValues.GENERAL,
      icon: <GearIcon />,
      label: 'com_nav_setting_general',
    },
    {
      value: SettingsTabValues.CHAT,
      icon: <MessageSquare className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_setting_chat',
    },
    {
      value: SettingsTabValues.COMMANDS,
      icon: <Command className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_commands',
    },
    {
      value: SettingsTabValues.SPEECH,
      icon: <SpeechIcon className="icon-sm" aria-hidden="true" />,
      label: 'com_nav_setting_speech',
    },
    ...(hasAnyPersonalizationFeature
      ? [
          {
            value: SettingsTabValues.PERSONALIZATION,
            icon: <PersonalizationIcon />,
            label: 'com_nav_setting_personalization' as TranslationKeys,
          },
        ]
      : []),
    {
      value: SettingsTabValues.DATA,
      icon: <DataIcon />,
      label: 'com_nav_setting_data',
    },
    ...(startupConfig?.balance?.enabled
      ? [
          {
            value: SettingsTabValues.BALANCE,
            icon: <DollarSign size={18} />,
            label: 'com_nav_setting_balance' as TranslationKeys,
          },
        ]
      : ([] as { value: SettingsTabValues; icon: React.JSX.Element; label: TranslationKeys }[])),
    {
      value: SettingsTabValues.ACCOUNT,
      icon: <UserIcon />,
      label: 'com_nav_setting_account',
    },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value as SettingsTabValues);
  };

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
                'max-h-[92vh] md:h-[600px] md:max-h-[85vh] md:w-[720px]',
              )}
            >
              <DialogTitle
                className="flex flex-shrink-0 items-center justify-between border-b border-border-light px-4 py-3.5 text-left sm:px-6 sm:py-4"
                as="div"
              >
                <h2 className="text-base font-semibold leading-6 text-text-primary sm:text-lg">
                  {localize('com_nav_settings')}
                </h2>
                <button
                  type="button"
                  aria-label={localize('com_ui_close_settings')}
                  className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy"
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
              <Tabs.Root
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex min-h-0 flex-1 flex-col md:flex-row"
                orientation="vertical"
              >
                <Tabs.List
                  aria-label="Settings"
                  className={cn(
                    'flex flex-shrink-0',
                    isSmallScreen
                      ? 'no-scrollbar w-full flex-row gap-1 overflow-x-auto border-b border-border-light px-2 py-2'
                      : 'w-56 flex-col gap-0.5 overflow-y-auto border-r border-border-light p-3',
                  )}
                  onKeyDown={handleKeyDown}
                >
                  {settingsTabs.map(({ value, icon, label }) => (
                    <Tabs.Trigger
                      key={value}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out',
                        'text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy',
                        'radix-state-active:bg-surface-tertiary radix-state-active:text-text-primary',
                        isSmallScreen
                          ? 'flex-shrink-0 whitespace-nowrap'
                          : 'w-full justify-start hover:bg-surface-hover hover:text-text-primary',
                      )}
                      value={value}
                      ref={(el) => (tabRefs.current[value] = el)}
                    >
                      <span className="flex flex-shrink-0 items-center justify-center">{icon}</span>
                      {localize(label)}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  <Tabs.Content value={SettingsTabValues.GENERAL} tabIndex={-1}>
                    <General />
                  </Tabs.Content>
                  <Tabs.Content value={SettingsTabValues.CHAT} tabIndex={-1}>
                    <Chat />
                  </Tabs.Content>
                  <Tabs.Content value={SettingsTabValues.COMMANDS} tabIndex={-1}>
                    <Commands />
                  </Tabs.Content>
                  <Tabs.Content value={SettingsTabValues.SPEECH} tabIndex={-1}>
                    <Speech />
                  </Tabs.Content>
                  {hasAnyPersonalizationFeature && (
                    <Tabs.Content value={SettingsTabValues.PERSONALIZATION} tabIndex={-1}>
                      <Personalization
                        hasMemoryOptOut={hasMemoryOptOut}
                        hasAnyPersonalizationFeature={hasAnyPersonalizationFeature}
                      />
                    </Tabs.Content>
                  )}
                  <Tabs.Content value={SettingsTabValues.DATA} tabIndex={-1}>
                    <Data />
                  </Tabs.Content>
                  {startupConfig?.balance?.enabled && (
                    <Tabs.Content value={SettingsTabValues.BALANCE} tabIndex={-1}>
                      <Balance />
                    </Tabs.Content>
                  )}
                  <Tabs.Content value={SettingsTabValues.ACCOUNT} tabIndex={-1}>
                    <Account />
                  </Tabs.Content>
                </div>
              </Tabs.Root>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
