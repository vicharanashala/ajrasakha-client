import { useMemo } from 'react';
import { useRecoilCallback } from 'recoil';
import { useRecoilValue } from 'recoil';
import { Box, ZapOff, Sigma, Brain, Shuffle } from 'lucide-react';
import type { BadgeItem } from '~/common';
import { useLocalize, TranslationKeys } from '~/hooks';
import store from '~/store';

interface ChatBadgeConfig {
  id: string;
  icon: any;
  label: string;
  atom?: any;
}

const badgeConfig: ReadonlyArray<ChatBadgeConfig> = [
  {
    id: '1',
    icon: Box,
    label: 'com_ui_artifacts',
    atom: store.artifactsVisibility,
  },
  {
    id: '2',
    icon: ZapOff,
    label: 'com_nav_default_temporary_chat',
    atom: store.isTemporary,
  },
  {
    id: '3',
    icon: Sigma,
    label: 'com_nav_latex_parsing',
    atom: store.LaTeXParsing,
  },
  {
    id: '4',
    icon: Brain,
    label: 'com_nav_show_thinking',
    atom: store.showThinking,
  },
  {
    id: '5',
    icon: Shuffle,
    label: 'com_nav_modular_chat',
    atom: store.modularChat,
  },
];

export default function useChatBadges(): BadgeItem[] {
  const localize = useLocalize();
  const activeBadges = useRecoilValue(store.chatBadges) as Array<{ id: string }>;
  const activeBadgeIds = useMemo(
    () => new Set(activeBadges.map((badge) => badge.id)),
    [activeBadges],
  );
  const allBadges = useMemo(() => {
    return (
      badgeConfig.map((cfg) => ({
        id: cfg.id,
        label: localize(cfg.label as TranslationKeys),
        icon: cfg.icon,
        atom: cfg.atom,
        isAvailable: activeBadgeIds.has(cfg.id),
      })) || []
    );
  }, [activeBadgeIds, localize]);
  return allBadges;
}

export function useResetChatBadges() {
  return useRecoilCallback(
    ({ reset }) =>
      () => {
        badgeConfig.forEach(({ atom }) => reset(atom));
        reset(store.chatBadges);
      },
    [],
  );
}
