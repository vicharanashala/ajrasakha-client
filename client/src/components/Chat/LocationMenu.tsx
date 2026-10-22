import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MapPin } from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';
import LocationEditor from './LocationEditor'; // adjust path if it lives elsewhere

export default function LocationMenu({ isSmallScreen }: { isSmallScreen?: boolean }) {
  const { user } = useAuthContext();
  const profile = user?.farmerProfile as IFarmerProfile | undefined;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position the portaled panel under the trigger
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    setPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }, [open]);

  // Close on outside click / Escape / resize
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  if (!profile) return null;

  // Location parts shown in the trigger. The first part is emphasised and the rest are muted.
  const parts = (
    isSmallScreen
      ? [profile.district, profile.state]
      : [profile.villageName, profile.blockName, profile.district, profile.state]
  ).filter(Boolean) as string[];
  const [primaryPart, ...otherParts] = parts;
  const fullAddress = [profile.villageName, profile.blockName, profile.district, profile.state]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={fullAddress ? `Location: ${fullAddress}. Change location` : 'Set location'}
        title={fullAddress || undefined}
        className="group flex max-w-[16rem] items-center gap-2 rounded-full border border-border-light bg-surface-primary py-1 pl-1 pr-3 text-sm shadow-sm transition-colors hover:border-border-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:max-w-md"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500 dark:text-green-400">
          <MapPin className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5 capitalize">
          <span className="max-w-[60%] shrink-0 truncate font-semibold text-text-primary">
            {primaryPart || 'Set location'}
          </span>
          {otherParts.length > 0 && (
            <span className="min-w-0 truncate text-text-secondary">{otherParts.join(', ')}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-tertiary transition-transform group-hover:text-text-primary',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Edit location"
            style={{ top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 16) }}
            className="fixed z-[110] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-border-light bg-surface-primary p-2 shadow-lg duration-150 animate-in fade-in-0 zoom-in-95"
          >
            <LocationEditor
              profile={profile}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
