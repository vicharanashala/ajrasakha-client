import React from 'react';
import { cn } from '~/utils';

interface ConvoLinkProps {
  isActiveConvo: boolean;
  isPopoverActive: boolean;
  title: string | null;
  onRename: () => void;
  isSmallScreen: boolean;
  localize: (key: any, options?: any) => string;
  children: React.ReactNode;
}

const ConvoLink: React.FC<ConvoLinkProps> = ({
  isActiveConvo,
  isPopoverActive,
  title,
  onRename,
  isSmallScreen,
  localize,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex grow items-center gap-2 overflow-hidden rounded-lg px-2',
        isActiveConvo || isPopoverActive ? 'font-semibold text-text-primary' : '',
      )}
      title={title ?? undefined}
      aria-current={isActiveConvo ? 'page' : undefined}
      style={{ width: '100%' }}
    >
      {/* Dot marks the open conversation. */}
      {isActiveConvo && <span className="size-1.5 flex-shrink-0 rounded-full bg-green-500" aria-hidden="true" />}
      {children}
      <div
        className="relative flex-1 grow overflow-hidden whitespace-nowrap text-ellipsis"
        style={{ textOverflow: 'ellipsis' }}
        onDoubleClick={(e) => {
          if (isSmallScreen) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          onRename();
        }}
        aria-label={title || localize('com_ui_untitled')}
      >
        {title || localize('com_ui_untitled')}
      </div>
    </div>
  );
};

export default ConvoLink;
