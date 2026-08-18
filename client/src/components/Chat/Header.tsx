import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getConfigDefaults, PermissionTypes, Permissions } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import { PresetsMenu, OpenSidebar } from './Menus';
// HeaderNewChat is intentionally not used below — the "New Chat" button outside
// the sidebar (next to the sidebar toggle) is disabled; the sidebar's own
// New Chat button is kept instead.
// import { HeaderNewChat } from './Menus';
import { useGetStartupConfig } from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useHasAccess } from '~/hooks';
import { cn } from '~/utils';

const defaultInterface = getConfigDefaults().interface;

export default function Header() {
  const { data: startupConfig } = useGetStartupConfig();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const [bannerPortal, setBannerPortal] = useState<Element | null>(null);

  useEffect(() => {
    const node = document.getElementById('banner-left-portal');
    if (node) setBannerPortal(node);
    const observer = new MutationObserver(() => {
      const p = document.getElementById('banner-left-portal');
      if (p !== bannerPortal) setBannerPortal(p);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [bannerPortal]);

  // ModelSelector moved into the chat input toolbar (left of the microphone button)
  const modelSelectorNodes = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
      {hasAccessToMultiConvo === true && <AddMultiConvo />}
    </div>
  );

  return (
    <div className="via-presentation/70 md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 absolute top-0 z-10 flex h-14 w-full items-center justify-between bg-gradient-to-b from-presentation to-transparent px-1.5 py-2 font-semibold text-text-primary sm:p-2 2xl:via-transparent">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-1.5 overflow-x-auto sm:gap-2">
        <div className="mx-1 flex w-full flex-1 items-center">
          <AnimatePresence initial={false}>
            {!navVisible && (
              <motion.div
                className="flex items-center gap-1.5 sm:gap-2"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                key="header-buttons"
              >
                <OpenSidebar setNavVisible={setNavVisible} className="max-md:hidden" />
                {/* HeaderNewChat disabled: keeping only the sidebar's New Chat button */}
                {/* <HeaderNewChat /> */}
              </motion.div>
            )}
          </AnimatePresence>
          {!isSmallScreen && bannerPortal ? createPortal(modelSelectorNodes, bannerPortal) : null}

          {!(navVisible && isSmallScreen) && (
            <div
              className={cn(
                'flex w-full flex-1 items-center gap-1.5 sm:gap-2',
                !isSmallScreen ? 'transition-all duration-200 ease-in-out' : '',
                !navVisible && !isSmallScreen ? 'pl-2' : '',
              )}
            >
              {/* {!bannerPortal && modelSelectorNodes} */}
              {hasAccessToBookmarks === true && <BookmarkMenu />}
              {isSmallScreen && (
                <div className="flex w-full flex-1 items-center justify-end gap-1.5">
                  {modelSelectorNodes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Temporary chat + share/export menu, pinned together to the top-right corner of the header */}
      <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1.5 sm:right-2 sm:top-2">
        <TemporaryChat />
        <ExportAndShareMenu isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false} />
      </div>
    </div>
  );
}
