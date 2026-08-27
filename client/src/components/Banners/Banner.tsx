import { useEffect, useRef } from 'react';
import { XIcon } from 'lucide-react';
import { useRecoilState } from 'recoil';
import { Button, cn } from '@librechat/client';
import { useGetBannerQuery } from '~/data-provider';
import store from '~/store';
import { useLocalize } from '~/hooks';

export const Banner = ({ onHeightChange }: { onHeightChange?: (height: number) => void }) => {
  const localize = useLocalize();
  // const { data: banner } = useGetBannerQuery();
  const [hideBannerHint, setHideBannerHint] = useRecoilState<string[]>(store.hideBannerHint);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onHeightChange && bannerRef.current) {
      onHeightChange(bannerRef.current.offsetHeight);
    }
  }, [hideBannerHint, onHeightChange]);
  const bannerId = 'global-banner';
  if (hideBannerHint.includes(bannerId)) {
    return null;
  }

  // const onClick = () => {
  //   if (banner.persistable) {
  //     return;
  //   }

  //   setHideBannerHint([...hideBannerHint, banner.bannerId]);

  //   if (onHeightChange) {
  //     onHeightChange(0);
  //   }
  // };
  const formattedMessage = localize('com_banner_message').replace(/\n/g, '<br />');
  return (
    <div
      ref={bannerRef}
      className="sticky top-0 z-20 flex w-full items-center justify-between bg-transparent px-3 py-2 md:relative"
    >
      <div id="banner-left-portal" className="z-30 flex min-w-[max-content] items-center"></div>
      {/* Small pill badge instead of a full-width text bar — a dev/testing notice reads as
          a quiet status chip, not a banner that competes with the header for attention. */}
      <div className="flex flex-1 items-center justify-center px-2">
        <div
          className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-full border border-border-light/60',
            'bg-surface-secondary/80 px-3 py-1 text-xs font-medium text-text-secondary shadow-sm backdrop-blur-sm',
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <span
            className="truncate whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: formattedMessage }}
          />
        </div>
      </div>
      {/* {!banner.persistable && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss banner"
          className="size-8"
          onClick={onClick}
        >
          <XIcon className="mx-auto h-4 w-4 text-text-primary" aria-hidden="true" />
        </Button>
      )} */}
    </div>
  );
};
