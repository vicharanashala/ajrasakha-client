import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MapPin } from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';
import LocationEditor from './LocationEditor'; // adjust path if it lives elsewhere

// The version suffix drops positions saved by earlier builds, which could sit over the top bar.
const POSITION_STORAGE_KEY_PREFIX = 'locationMenuPosition:v2';
const EDGE_GAP = 8;
// Lowest top offset while dragging; the pill may now sit over the mobile top bar.
const MIN_TOP = EDGE_GAP;
const DRAG_THRESHOLD = 5;
// Outer pill shared by the location button and any leading segment such as the weather button.
const PILL_CLASS =
  'flex max-w-[16rem] items-center gap-0.5 rounded-full border border-border-light bg-surface-primary p-0.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border-medium motion-reduce:transition-none sm:max-w-lg';

type Position = { left: number; top: number };

// Reads the saved pill position for a user, ignoring missing or invalid values.
function readSavedPosition(storageKey: string): Position | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return typeof saved?.left === 'number' && typeof saved?.top === 'number' ? saved : null;
  } catch {
    return null;
  }
}

// Keeps the pill fully inside the viewport.
function clampPosition(position: Position, width: number, height: number): Position {
  return {
    left: Math.min(Math.max(EDGE_GAP, position.left), Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP)),
    top: Math.min(Math.max(MIN_TOP, position.top), Math.max(MIN_TOP, window.innerHeight - height - EDGE_GAP)),
  };
}

type LocationMenuProps = {
  isSmallScreen?: boolean;
  // Extra segment rendered at the start of the same pill, e.g. the weather button.
  leading?: ReactNode;
};

// Header pill showing the farmer's location. A leading segment shares the pill and moves with it when dragged.
export default function LocationMenu({ isSmallScreen, leading }: LocationMenuProps) {
  const { user } = useAuthContext();
  const profile = user?.farmerProfile as IFarmerProfile | undefined;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 0,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  // The whole pill. It is what gets dragged and pinned on small screens.
  const pillRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Dragged position of the pill. While null the pill stays in its normal place in the header.
  // The position is saved per user, so accounts sharing a browser keep their own spot.
  const positionStorageKey = `${POSITION_STORAGE_KEY_PREFIX}:${user?.id ?? 'guest'}`;
  const [dragPosition, setDragPosition] = useState<Position | null>(() =>
    readSavedPosition(positionStorageKey),
  );

  // Loads the saved position again when a different user signs in.
  useEffect(() => {
    setDragPosition(readSavedPosition(positionStorageKey));
  }, [positionStorageKey]);

  const [isDragging, setIsDragging] = useState(false);
  // Dragging is only available on small screens, larger screens always use the default place.
  const activePosition = isSmallScreen ? dragPosition : null;
  const dragRef = useRef({ startX: 0, startY: 0, originLeft: 0, originTop: 0, width: 0, height: 0, moved: false });
  const suppressClickRef = useRef(false);

  // Starts a drag from the pill. The drag only counts once the pointer moves past a small threshold.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSmallScreen || event.button !== 0 || !pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    suppressClickRef.current = false;
    setIsDragging(true);
  };

  // Follows the pointer while dragging and saves the final position.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      setOpen(false);
      setDragPosition(
        clampPosition({ left: drag.originLeft + dx, top: drag.originTop + dy }, drag.width, drag.height),
      );
    };
    const onUp = () => {
      setIsDragging(false);
      if (!dragRef.current.moved) return;
      suppressClickRef.current = true;
      setDragPosition((position) => {
        try {
          localStorage.setItem(positionStorageKey, JSON.stringify(position));
        } catch {
          // Storage can be unavailable, the position then lasts for this session only.
        }
        return position;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging, positionStorageKey]);

  // Keeps a dragged pill on screen when the window is resized.
  useEffect(() => {
    if (!activePosition) return;
    const onResize = () => {
      const rect = pillRef.current?.getBoundingClientRect();
      if (rect) setDragPosition((position) => position && clampPosition(position, rect.width, rect.height));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activePosition === null]);

  // Puts the pill back in its default place in the header.
  const resetPosition = () => {
    setOpen(false);
    setDragPosition(null);
    try {
      localStorage.removeItem(positionStorageKey);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  };

  // Position the portaled panel next to the trigger. The visible height is used so that on phones
  // the panel stays above the on-screen keyboard, and it is recalculated when the keyboard moves.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      // Opens upward when the pill sits in the lower half of the screen so the panel stays visible.
      if (rect.top > visibleHeight / 2) {
        setPos({ bottom: window.innerHeight - rect.top + 8, left, maxHeight: rect.top - 16 });
      } else {
        setPos({ top: rect.bottom + 8, left, maxHeight: visibleHeight - rect.bottom - 16 });
      }
    };
    updatePosition();
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => window.visualViewport?.removeEventListener('resize', updatePosition);
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
    // Only a width change closes the panel. Opening the phone keyboard changes the height alone.
    const openedWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== openedWidth) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Without a saved location the leading segment still shows on its own.
  if (!profile) {
    return leading ? <div className={PILL_CLASS}>{leading}</div> : null;
  }

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

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      onDoubleClick={activePosition ? resetPosition : undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={fullAddress ? `Location: ${fullAddress}. Change location` : 'Set location'}
      title={
        fullAddress
          ? `${fullAddress}${isSmallScreen ? `. Drag to move${activePosition ? ', double tap to reset' : ''}` : ''}`
          : undefined
      }
      className={cn(
        'group flex min-h-9 min-w-0 items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary motion-reduce:transition-none sm:pr-3',
        !leading && 'pl-1.5',
        open && 'bg-surface-hover',
      )}
    >
      <MapPin className="size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
      <span className="flex min-w-0 items-baseline gap-1.5 capitalize">
        <span className="max-w-full shrink-0 truncate font-semibold text-text-primary sm:max-w-[60%]">
          {primaryPart || 'Set location'}
        </span>
        {otherParts.length > 0 && (
          <span className="hidden min-w-0 truncate text-text-secondary sm:inline">
            {otherParts.join(', ')}
          </span>
        )}
      </span>
      <ChevronDown
        className={cn(
          'size-4 shrink-0 text-text-tertiary transition-transform duration-200 group-hover:text-text-primary motion-reduce:transition-none',
          open && 'rotate-180',
        )}
        aria-hidden="true"
      />
    </button>
  );

  // One pill holding the leading segment and the location button. Dragging works from either segment,
  // and a click that ends a drag is swallowed here so neither segment opens by accident.
  const pill = (
    <div
      ref={pillRef}
      onPointerDown={handlePointerDown}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
      style={
        activePosition
          ? { left: activePosition.left, top: activePosition.top, touchAction: 'none' }
          : isSmallScreen
            ? { touchAction: 'none' }
            : undefined
      }
      className={cn(
        PILL_CLASS,
        isSmallScreen && 'cursor-grab select-none active:cursor-grabbing',
        activePosition && 'fixed z-40',
        isDragging && 'shadow-lg',
      )}
    >
      {leading}
      {leading && <span className="h-5 w-px shrink-0 bg-border-light" aria-hidden="true" />}
      {triggerButton}
    </div>
  );

  return (
    <>
      {/* The pill stays in the header until a small screen user drags it elsewhere. */}
      {activePosition ? createPortal(pill, document.body) : pill}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Edit location"
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              maxHeight: pos.maxHeight,
              width: Math.min(320, window.innerWidth - 16),
            }}
            className="fixed z-[110] overflow-y-auto rounded-xl border border-border-light bg-surface-primary p-2 shadow-lg duration-150 animate-in fade-in-0 zoom-in-95"
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
