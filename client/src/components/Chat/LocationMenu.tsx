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

  const summary = (
    isSmallScreen
      ? [profile.district, profile.state]
      : [profile.villageName, profile.blockName, profile.district, profile.state]
  )
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
        className="flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-border-light bg-surface-primary px-2.5 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-hover sm:max-w-sm"
      >
        <MapPin className="h-4 w-4 shrink-0 text-text-secondary" />
        <span className="truncate capitalize">{summary || 'Set location'}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Edit location"
            style={{ top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 16) }}
            className="fixed z-[110] rounded-xl border border-border-light bg-surface-primary p-2 shadow-lg"
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
