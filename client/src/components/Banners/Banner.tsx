import { useEffect, useRef } from 'react';
import { XIcon } from 'lucide-react';
import { useRecoilState } from 'recoil';
import { Button } from '@librechat/client';
import { useGetBannerQuery } from '~/data-provider';
import store from '~/store';

/** Thin top strip that only hosts the header's left-side portal. The in-development notice
 *  it used to show now sits below the chat composer, in Footer. */
export const Banner = ({ onHeightChange }: { onHeightChange?: (height: number) => void }) => {
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
  // The header only portals content in here on md+, so the strip collapses to nothing on
  // small screens instead of leaving dead space where the notice used to be.
  return (
    <div
      ref={bannerRef}
      className="sticky top-0 z-20 flex w-full items-center justify-between bg-transparent px-3 py-0 md:relative md:py-2"
    >
      <div id="banner-left-portal" className="z-30 flex min-w-[max-content] items-center"></div>
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
