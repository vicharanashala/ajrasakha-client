import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Flag,
  Home,
  LayoutGrid,
  Loader2,
  MapPinned,
  Pencil,
  Search,
  Sprout,
} from 'lucide-react';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useSaveFarmerProfileMutation } from '~/data-provider';
import { cn } from '~/utils';

type Level = 'state' | 'district' | 'blockName' | 'villageName' | 'nearestKVK';
type Option = { code: number | string; name: string };
type Draft = Record<Level, string>;

const LEVELS: Level[] = ['state', 'district', 'blockName', 'villageName', 'nearestKVK'];
const LABELS: Record<Level, string> = {
  state: 'State',
  district: 'District',
  blockName: 'Block',
  villageName: 'Village',
  nearestKVK: 'Nearest KVK',
};
// Icon shown beside each location level.
const LEVEL_ICONS = {
  state: Flag,
  district: MapPinned,
  blockName: LayoutGrid,
  villageName: Home,
  nearestKVK: Sprout,
};
const ANCESTORS: Record<Level, Level[]> = {
  state: [],
  district: ['state'],
  blockName: ['state', 'district'],
  villageName: ['state', 'district', 'blockName'],
  nearestKVK: ['state', 'district'],
};
const DESCENDANTS: Record<Level, Level[]> = {
  state: ['district', 'blockName', 'villageName', 'nearestKVK'],
  district: ['blockName', 'villageName', 'nearestKVK'],
  blockName: ['villageName'],
  villageName: [],
  nearestKVK: [],
};

// Proxied through this server, which adds the review-system API key
const baseUrl = '/api';
// On touch screens focusing the search box opens the keyboard, which covers the panel buttons.
const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const asList = (d: unknown): Option[] => (Array.isArray(d) ? d : []);
const norm = (s: string) => s.trim().toLowerCase();
// Comparison key that ignores case, "&" vs "and", spacing and punctuation, so saved names still match the API lists.
const matchKey = (s: string) =>
  norm(s)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
const same = (a: string, b: string) => matchKey(a) === matchKey(b);
// Finds a list option by name, retrying without a trailing "(code)" suffix such as "Village(76)".
const findByName = (list: Option[], name: string) => {
  if (!name) {
    return undefined;
  }
  const exact = list.find((o) => same(o.name, name));
  if (exact) {
    return exact;
  }
  const bare = (v: string) => v.replace(/\s*\([^)]*\)\s*$/, '');
  return list.find((o) => same(bare(o.name), bare(name)));
};

// Placeholders saved by the old form ("Other", "NA"...) count as empty
const BLANK = new Set(['other', 'others', 'na', 'n/a', 'none', '-', '--', 'select']);
const clean = (v?: string) => (v && !BLANK.has(norm(v)) ? v : '');

const draftFromProfile = (p?: Partial<IFarmerProfile>): Draft => ({
  state: clean(p?.state),
  district: clean(p?.district),
  blockName: clean(p?.blockName),
  villageName: clean(p?.villageName),
  nearestKVK: clean(p?.nearestKVK),
});
const missingAncestor = (l: Level, d: Draft) => ANCESTORS[l].find((a) => !d[a]);

type Props = {
  profile: IFarmerProfile;
  /** true = every field must be filled (popup for incomplete profiles) */
  requireAll?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
};

export default function LocationEditor({
  profile,
  requireAll,
  onSaved,
  onCancel,
  cancelLabel = 'Cancel',
}: Props) {
  const queryClient = useQueryClient();
  const original = draftFromProfile(profile);
  const [draft, setDraft] = useState<Draft>(original);
  const [editing, setEditing] = useState<Level | null>(
    () => LEVELS.find((l) => !original[l] && !missingAncestor(l, original)) ?? null,
  );
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Query keys use a locationEditor prefix so they never share cache with the older farmer modals,
  // which store failed or empty responses under the same keys and would hide the lists here.
  // Failed requests are reported as errors (so they can be retried) instead of being stored as an
  // empty list, which would otherwise show "No options found" until the page is reloaded.
  const q = <T,>(key: unknown[], enabled: boolean, fn: () => Promise<T[]>) =>
    useQuery<T[]>({
      queryKey: key,
      queryFn: fn,
      enabled,
      staleTime: Infinity,
      retry: 1,
    });

  const { data: states = [], isFetching: sLoad, isError: sErr, refetch: sRetry } = q<Option>(['locationEditor', 'states'], true, async () =>
    asList(await dataService.getLocationStates(baseUrl)),
  );
  const stateObj = findByName(states, draft.state);
  const { data: districts = [], isFetching: dLoad, isError: dErr, refetch: dRetry } = q<Option>(
    ['locationEditor', 'districts', stateObj?.code, draft.state],
    stateObj?.code !== undefined,
    async () => asList(await dataService.getLocationDistricts(baseUrl, stateObj!.code)),
  );
  const districtObj = findByName(districts, draft.district);
  const { data: blocks = [], isFetching: bLoad, isError: bErr, refetch: bRetry } = q<Option>(
    ['locationEditor', 'subdistricts', districtObj?.code, draft.district],
    districtObj?.code !== undefined,
    async () => asList(await dataService.getLocationBlocks(baseUrl, districtObj!.code)),
  );
  const blockObj = findByName(blocks, draft.blockName);
  const { data: villages = [], isFetching: vLoad, isError: vErr, refetch: vRetry } = q<Option>(
    ['locationEditor', 'villages', blockObj?.code, draft.blockName],
    blockObj?.code !== undefined,
    async () => asList(await dataService.getLocationVillages(baseUrl, blockObj!.code)),
  );
  const { data: kvks = [], isFetching: kLoad, isError: kErr, refetch: kRetry } = q<Option>(
    ['locationEditor', 'kvks', districtObj?.code, draft.district],
    districtObj?.code !== undefined,
    async () => {
      const data = await dataService.getLocationKvks(baseUrl, districtObj!.code);
      return Array.isArray(data)
        ? data.map((k: any) => ({
            code: k.kvkId,
            name: k.kvkAddress ? `${k.kvkName}, ${k.kvkAddress}` : k.kvkName,
          }))
        : [];
    },
  );

  const options: Record<Level, string[]> = {
    state: states.map((x) => x.name),
    district: districts.map((x) => x.name),
    blockName: blocks.map((x) => x.name),
    villageName: villages.map((x) => x.name),
    nearestKVK: kvks.map((x) => x.name),
  };
  const loading: Record<Level, boolean> = {
    state: sLoad,
    district: dLoad,
    blockName: bLoad,
    villageName: vLoad,
    nearestKVK: kLoad,
  };

  const failed: Record<Level, boolean> = {
    state: sErr,
    district: dErr,
    blockName: bErr,
    villageName: vErr,
    nearestKVK: kErr,
  };
  const retryLoad: Record<Level, () => void> = {
    state: () => void sRetry(),
    district: () => void dRetry(),
    blockName: () => void bRetry(),
    villageName: () => void vRetry(),
    nearestKVK: () => void kRetry(),
  };

  const saveMutation = useSaveFarmerProfileMutation({
    onSuccess: (data: any, v: Partial<IFarmerProfile>) => {
      const lower = (s = '') => s.trim().toLowerCase();
      queryClient.setQueryData([QueryKeys.user], (old: any) =>
        old
          ? {
              ...old,
              farmerProfile: {
                ...old.farmerProfile,
                state: lower(v.state),
                district: lower(v.district),
                blockName: lower(v.blockName),
                villageName: lower(v.villageName),
                nearestKVK: (v.nearestKVK ?? '').trim(),
                ...(data?.latitude !== undefined && data?.longitude !== undefined
                  ? { location: { latitude: data.latitude, longitude: data.longitude } }
                  : {}),
              },
            }
          : old,
      );
      queryClient.invalidateQueries([QueryKeys.user]);
      queryClient.invalidateQueries([QueryKeys.userTerms]);
      onSaved();
    },
    onError: () => setError('Could not save your location. Please try again.'),
  });

  const pick = (level: Level, value: string) => {
    setSearch('');
    if (same(value, draft[level])) {
      setEditing(null);
      return;
    }
    const next: Draft = { ...draft, [level]: value };
    DESCENDANTS[level].forEach((l) => (next[l] = ''));
    setDraft(next);
    setEditing(
      LEVELS.slice(LEVELS.indexOf(level) + 1).find((l) => !next[l] && !missingAncestor(l, next)) ??
        null,
    );
  };

  const dirty = LEVELS.some((l) => !same(draft[l], original[l]));
  const stateChanged = !same(draft.state, original.state);
  const districtChanged = !same(draft.district, original.district);
  const mustComplete = requireAll || stateChanged || districtChanged;
  const missingRequired = mustComplete
    ? LEVELS.some(
        (l) =>
          !draft[l] && (l === 'state' || l === 'district' || loading[l] || options[l].length > 0),
      )
    : !draft.state || !draft.district;
  const canSave = (requireAll || dirty) && !missingRequired && !saveMutation.isLoading;

  const filtered = editing
    ? options[editing].filter(
        (o) => !search.trim() || o.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : [];

  return (
    <div className="text-sm text-text-primary">
      <ul className="flex flex-col gap-1">
        {LEVELS.map((level) => {
          const reason = missingAncestor(level, draft);
          const isEditing = editing === level;
          const LevelIcon = LEVEL_ICONS[level];
          return (
            <li key={level}>
              <button
                type="button"
                disabled={!!reason}
                aria-expanded={isEditing}
                title={reason ? `Select ${LABELS[reason]} first` : `Edit ${LABELS[level]}`}
                onClick={() => {
                  setSearch('');
                  setEditing(isEditing ? null : level);
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                  isEditing && 'bg-surface-secondary',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500 dark:text-green-400">
                  <LevelIcon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-text-secondary">{LABELS[level]}</span>
                  <span
                    title={draft[level] || undefined}
                    className={cn(
                      'block truncate font-semibold',
                      level !== 'nearestKVK' && 'capitalize',
                      draft[level] ? 'text-text-primary' : 'font-normal text-text-tertiary',
                    )}
                  >
                    {draft[level] || `Select ${LABELS[level]}`}
                  </span>
                </span>
                <Pencil
                  className="size-4 shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"
                  aria-hidden="true"
                />
              </button>
              {isEditing && (
                <div className="mx-1 mb-2 mt-1 overflow-hidden rounded-lg border border-border-light bg-surface-primary">
                  <div className="flex items-center gap-2 border-b border-border-light px-3 py-2">
                    <Search className="size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                    <input
                      autoFocus={!isTouchDevice()}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Search ${LABELS[level]}…`}
                      aria-label={`Search ${LABELS[level]}`}
                      className="w-full bg-transparent outline-none placeholder:text-text-tertiary"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {loading[level] ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-text-secondary">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
                      </div>
                    ) : failed[level] ? (
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-text-secondary">
                        <span>Could not load {LABELS[level]} options.</span>
                        <button
                          type="button"
                          onClick={() => retryLoad[level]()}
                          className="shrink-0 rounded-md px-2 py-1 font-medium text-green-600 hover:bg-surface-hover dark:text-green-400"
                        >
                          Retry
                        </button>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="px-3 py-2 text-text-secondary">No options found</div>
                    ) : (
                      filtered.map((name, index) => {
                        const selected = same(name, draft[level]);
                        return (
                          <button
                            // Some lists contain repeated names, so the index keeps keys unique.
                            key={`${name}-${index}`}
                            type="button"
                            onClick={() => pick(level, name)}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
                              selected && 'bg-green-500/10 font-medium',
                            )}
                          >
                            <span className="break-words">{name}</span>
                            {selected && (
                              <Check
                                className="size-4 shrink-0 text-green-500 dark:text-green-400"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="px-2 pb-1 text-xs text-red-500">{error}</p>}
      <div className="sticky bottom-0 mt-2 flex justify-end gap-2 border-t border-border-light bg-surface-primary px-1 pb-1 pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            setError('');
            saveMutation.mutate({
              state: draft.state,
              district: draft.district,
              blockName: draft.blockName,
              villageName: draft.villageName,
              nearestKVK: draft.nearestKVK,
            } as IFarmerProfile);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
