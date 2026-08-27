import React, { useEffect } from 'react';
import TagManager from 'react-gtm-module';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

/**
 * Sits directly beneath the chat composer and carries the in-development notice, which
 * previously lived in the top Banner. Shown on every screen size; the legal links and
 * version string that used to render here were removed.
 */
export default function Footer({ className }: { className?: string }) {
  const { data: config } = useGetStartupConfig();
  const localize = useLocalize();

  useEffect(() => {
    if (config?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      TagManager.initialize({ gtmId: config.analyticsGtmId });
    }
  }, [config?.analyticsGtmId]);

  return (
    <div className="relative w-full">
      {/* In normal flow on small screens, where the composer strip is fixed to the bottom
          and an absolutely positioned line would fall off-screen. From sm up it keeps the
          original overlay position inside the composer's bottom margin. */}
      <div
        className={
          className ??
          'flex items-center justify-center gap-1.5 px-2 py-1 text-center text-xs text-text-secondary sm:absolute sm:bottom-0 sm:left-0 sm:right-0 sm:py-1.5 md:px-[60px]'
        }
        role="contentinfo"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
        <span className="whitespace-pre-line">{localize('com_banner_message')}</span>
      </div>
    </div>
  );
}
