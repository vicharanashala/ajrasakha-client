import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  memo,
  lazy,
  Suspense,
  useRef,
  startTransition,
} from 'react';
import { useRecoilValue } from 'recoil';
import { Sun, Moon } from 'lucide-react';
import { Skeleton, useMediaQuery, TooltipAnchor, useTheme, isDark } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { InfiniteQueryObserverResult } from '@tanstack/react-query';
import type { ConversationListResponse } from 'librechat-data-provider';
import type { List } from 'react-virtualized';
import {
  useLocalize,
  useHasAccess,
  useAuthContext,
  useLocalStorage,
  useNavScrolling,
} from '~/hooks';
import { useConversationsInfiniteQuery, useTitleGeneration } from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import SearchBar from './SearchBar';
import NewChat from './NewChat';
import { cn } from '~/utils';
import store from '~/store';

const BookmarkNav = lazy(() => import('./Bookmarks/BookmarkNav'));
const AccountSettings = lazy(() => import('./AccountSettings'));
const NotificationBell = lazy(() => import('./NotificationBell'));

export const NAV_WIDTH = {
  MOBILE: 320,
  DESKTOP: 260,
  // Slim icon rail shown on desktop when the sidebar is collapsed, instead of
  // hiding it completely.
  COLLAPSED: 64,
} as const;

const SearchBarSkeleton = memo(() => (
  <div className={cn('flex h-10 items-center py-2')}>
    <Skeleton className="h-10 w-full rounded-lg" />
  </div>
));

SearchBarSkeleton.displayName = 'SearchBarSkeleton';

const NavMask = memo(
  ({ navVisible, toggleNavVisible }: { navVisible: boolean; toggleNavVisible: () => void }) => (
    <div
      id="mobile-nav-mask-toggle"
      role="button"
      tabIndex={0}
      className={`nav-mask transition-opacity duration-200 ease-in-out ${navVisible ? 'active opacity-100' : 'opacity-0'}`}
      onClick={toggleNavVisible}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleNavVisible();
        }
      }}
      aria-label="Toggle navigation"
    />
  ),
);

const MemoNewChat = memo(NewChat);

// Compact light/dark toggle sized to match the sidebar's other small icon
// buttons (~28px). The shared `ThemeSelector` component (from
// packages/client, also used on the login screen) auto-sizes itself from
// icon size + padding to roughly 40px, which read as noticeably bigger than
// everything else down here — so this reimplements just the toggle
// behavior locally instead, using the same `useTheme`/`isDark` primitives.
const ThemeToggleButton = memo(({ side = 'top' }: { side?: 'top' | 'right' }) => {
  const localize = useLocalize();
  const { theme, setTheme } = useTheme();
  const dark = isDark(theme);

  return (
    <TooltipAnchor
      description={localize('com_ui_toggle_theme')}
      side={side}
      render={
        <button
          type="button"
          aria-label={localize('com_ui_toggle_theme')}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-text-primary duration-0 hover:bg-surface-active-alt"
        >
          {dark ? (
            <Moon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Sun className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
});
ThemeToggleButton.displayName = 'ThemeToggleButton';

const Nav = memo(
  ({
    navVisible,
    setNavVisible,
  }: {
    navVisible: boolean;
    setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const localize = useLocalize();
    const { isAuthenticated } = useAuthContext();
    useTitleGeneration(isAuthenticated);

    const isSmallScreen = useMediaQuery('(max-width: 768px)');
    const [newUser, setNewUser] = useLocalStorage('newUser', true);
    const [isChatsExpanded, setIsChatsExpanded] = useLocalStorage('chatsExpanded', true);
    const [showLoading, setShowLoading] = useState(false);
    const [tags, setTags] = useState<string[]>([]);

    const hasAccessToBookmarks = useHasAccess({
      permissionType: PermissionTypes.BOOKMARKS,
      permission: Permissions.USE,
    });

    const search = useRecoilValue(store.search);

    const { data, fetchNextPage, isFetchingNextPage, isLoading, isFetching, refetch } =
      useConversationsInfiniteQuery(
        {
          tags: tags.length === 0 ? undefined : tags,
          search: search.debouncedQuery || undefined,
        },
        {
          enabled: isAuthenticated,
          staleTime: 30000,
          cacheTime: 300000,
        },
      );

    const computedHasNextPage = useMemo(() => {
      if (data?.pages && data.pages.length > 0) {
        const lastPage: ConversationListResponse = data.pages[data.pages.length - 1];
        return lastPage.nextCursor !== null;
      }
      return false;
    }, [data?.pages]);

    const outerContainerRef = useRef<HTMLDivElement>(null);
    const conversationsRef = useRef<List | null>(null);

    const { moveToTop } = useNavScrolling<ConversationListResponse>({
      setShowLoading,
      fetchNextPage: async (options?) => {
        if (computedHasNextPage) {
          return fetchNextPage(options);
        }
        return Promise.resolve(
          {} as InfiniteQueryObserverResult<ConversationListResponse, unknown>,
        );
      },
      isFetchingNext: isFetchingNextPage,
    });

    const conversations = useMemo(() => {
      return data ? data.pages.flatMap((page) => page.conversations) : [];
    }, [data]);

    const toggleNavVisible = useCallback(() => {
      // Use startTransition to mark this as a non-urgent update
      // This prevents blocking the main thread during the cascade of re-renders
      startTransition(() => {
        setNavVisible((prev: boolean) => {
          localStorage.setItem('navVisible', JSON.stringify(!prev));
          return !prev;
        });
        if (newUser) {
          setNewUser(false);
        }
      });
    }, [newUser, setNavVisible, setNewUser]);

    const itemToggleNav = useCallback(() => {
      if (isSmallScreen) {
        toggleNavVisible();
      }
    }, [isSmallScreen, toggleNavVisible]);

    useEffect(() => {
      if (isSmallScreen) {
        const savedNavVisible = localStorage.getItem('navVisible');
        if (savedNavVisible === null) {
          toggleNavVisible();
        }
      }
    }, [isSmallScreen, toggleNavVisible]);

    useEffect(() => {
      refetch();
    }, [tags, refetch]);

    const loadMoreConversations = useCallback(() => {
      if (isFetchingNextPage || !computedHasNextPage) {
        return;
      }

      fetchNextPage();
    }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

    const subHeaders = useMemo(
      () => (
        <>
          {search.enabled === null && <SearchBarSkeleton />}
          {search.enabled === true && <SearchBar isSmallScreen={isSmallScreen} />}
        </>
      ),
      [search.enabled, isSmallScreen],
    );

    const headerButtons = useMemo(
      () => (
        <>
          {hasAccessToBookmarks && (
            <>
              <div className="mt-1.5" />
              <Suspense fallback={null}>
                <BookmarkNav tags={tags} setTags={setTags} />
              </Suspense>
            </>
          )}
        </>
      ),
      [hasAccessToBookmarks, tags],
    );

    const [isSearchLoading, setIsSearchLoading] = useState(
      !!search.query && (search.isTyping || isLoading || isFetching),
    );

    useEffect(() => {
      if (search.isTyping) {
        setIsSearchLoading(true);
      } else if (!isLoading && !isFetching) {
        setIsSearchLoading(false);
      } else if (!!search.query && (isLoading || isFetching)) {
        setIsSearchLoading(true);
      }
    }, [search.query, search.isTyping, isLoading, isFetching]);

    // Always render sidebar to avoid mount/unmount costs
    // Use transform for GPU-accelerated animation (no layout thrashing)
    const sidebarWidth = isSmallScreen ? NAV_WIDTH.MOBILE : NAV_WIDTH.DESKTOP;

    // Sidebar content (shared between mobile and desktop)
    const sidebarContent = (
      <div className="flex h-full flex-col">
        <nav
          id="chat-history-nav"
          aria-label={localize('com_ui_chat_history')}
          className="flex h-full flex-col px-2 pb-3.5"
          aria-hidden={!navVisible}
        >
          <div className="flex flex-1 flex-col overflow-hidden" ref={outerContainerRef}>
            <MemoNewChat
              subHeaders={subHeaders}
              toggleNav={toggleNavVisible}
              headerButtons={headerButtons}
              isSmallScreen={isSmallScreen}
              notificationBell={
                <Suspense fallback={null}>
                  <NotificationBell />
                </Suspense>
              }
            />
            <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
              <Conversations
                conversations={conversations}
                moveToTop={moveToTop}
                toggleNav={itemToggleNav}
                containerRef={conversationsRef}
                loadMoreConversations={loadMoreConversations}
                isLoading={isFetchingNextPage || showLoading || isLoading}
                isSearchLoading={isSearchLoading}
                isChatsExpanded={isChatsExpanded}
                setIsChatsExpanded={setIsChatsExpanded}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <Suspense fallback={<Skeleton className="mt-1 h-12 w-full rounded-xl" />}>
                <AccountSettings />
              </Suspense>
            </div>
            {/* Theme toggle, pinned to the opposite side of the row from the
                profile avatar — mirrors the logo/collapse-button pairing at
                the top of the expanded sidebar. */}
            <ThemeToggleButton />
          </div>
        </nav>
      </div>
    );

    // Collapsed rail (desktop only): a slim strip with the sidebar toggle,
    // New Chat, and notifications stacked at the top, and the theme toggle +
    // profile avatar pinned to the bottom — instead of hiding the sidebar
    // completely.
    const collapsedContent = (
      <div className="flex h-full flex-col">
        <nav
          id="chat-history-nav-collapsed"
          aria-label={localize('com_ui_chat_history')}
          className="flex h-full flex-col items-center px-1.5 pb-3.5"
          aria-hidden={navVisible}
        >
          <div className="flex flex-1 flex-col items-center overflow-hidden">
            <MemoNewChat
              toggleNav={toggleNavVisible}
              isSmallScreen={isSmallScreen}
              collapsed
              notificationBell={
                <Suspense fallback={null}>
                  <NotificationBell collapsed />
                </Suspense>
              }
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <ThemeToggleButton side="right" />
            <Suspense fallback={<Skeleton className="mt-1 h-10 w-10 rounded-xl" />}>
              <AccountSettings collapsed />
            </Suspense>
          </div>
        </nav>
      </div>
    );

    // Mobile: Fixed positioned sidebar that slides over content
    // Uses CSS transitions (not Framer Motion) to sync perfectly with content animation
    if (isSmallScreen) {
      return (
        <>
          <div
            data-testid="nav"
            className={cn(
              'nav fixed left-0 top-0 z-[70] h-full bg-surface-primary-alt',
              navVisible && 'active',
            )}
            style={{
              width: sidebarWidth,
              transform: navVisible ? 'translateX(0)' : `translateX(-${sidebarWidth}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            {sidebarContent}
          </div>
          <NavMask navVisible={navVisible} toggleNavVisible={toggleNavVisible} />
        </>
      );
    }

    // Desktop: Inline sidebar with width transition. When collapsed, a slim
    // icon rail stays visible instead of shrinking to nothing.
    const desktopWidth = navVisible ? sidebarWidth : NAV_WIDTH.COLLAPSED;
    return (
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{ width: desktopWidth, transition: 'width 0.2s ease-out' }}
      >
        <div
          data-testid="nav"
          // Always keep the shared `.nav.active` styles on desktop (position:
          // relative, opacity: 1) — the base `.nav` rule in mobile.css sets
          // opacity: 0 and position: fixed, which is meant for the mobile
          // slide-in/out animation. On desktop, visibility is driven purely
          // by the width transition above, so the rail must stay "active"
          // even while collapsed or it renders invisible.
          // The collapsed rail blends into the chat area's background
          // (bg-presentation) in both light and dark mode, instead of
          // keeping the sidebar's usual surface-primary-alt shade.
          className={cn('nav active h-full', navVisible ? 'bg-surface-primary-alt' : 'bg-presentation')}
          style={{ width: desktopWidth, transition: 'width 0.2s ease-out' }}
        >
          {navVisible ? sidebarContent : collapsedContent}
        </div>
      </div>
    );
  },
);

Nav.displayName = 'Nav';

export default Nav;
