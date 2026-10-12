import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Search } from 'lucide-react';
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

const baseUrl = import.meta.env.VITE_AJRASAKHA_SERVER_URL ?? '';
const asList = (d: unknown): Option[] => (Array.isArray(d) ? d : []);
const norm = (s: string) => s.trim().toLowerCase();
const same = (a: string, b: string) => norm(a) === norm(b);
const findByName = (list: Option[], name: string) =>
  name ? list.find((o) => same(o.name, name)) : undefined;

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

  const q = <T,>(key: unknown[], enabled: boolean, fn: () => Promise<T[]>) =>
    useQuery<T[]>({
      queryKey: key,
      queryFn: async () => {
        try {
          return await fn();
        } catch (e) {
          console.error(e);
          return [];
        }
      },
      enabled,
      staleTime: Infinity,
    });

  const { data: states = [], isFetching: sLoad } = q<Option>(['states'], true, async () =>
    asList(await dataService.getLocationStates(baseUrl)),
  );
  const stateObj = findByName(states, draft.state);
  const { data: districts = [], isFetching: dLoad } = q<Option>(
    ['districts', stateObj?.code, draft.state],
    stateObj?.code !== undefined,
    async () => asList(await dataService.getLocationDistricts(baseUrl, stateObj!.code)),
  );
  const districtObj = findByName(districts, draft.district);
  const { data: blocks = [], isFetching: bLoad } = q<Option>(
    ['subdistricts', districtObj?.code, draft.district],
    districtObj?.code !== undefined,
    async () => asList(await dataService.getLocationBlocks(baseUrl, districtObj!.code)),
  );
  const blockObj = findByName(blocks, draft.blockName);
  const { data: villages = [], isFetching: vLoad } = q<Option>(
    ['villages', blockObj?.code, draft.blockName],
    blockObj?.code !== undefined,
    async () => asList(await dataService.getLocationVillages(baseUrl, blockObj!.code)),
  );
  const { data: kvks = [], isFetching: kLoad } = q<Option>(
    ['kvks', districtObj?.code, draft.district],
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
      <ul className="flex flex-col">
        {LEVELS.map((level) => {
          const reason = missingAncestor(level, draft);
          const isEditing = editing === level;
          return (
            <li key={level}>
              <div className="flex items-center justify-between gap-2 px-2 py-2">
                <div className="min-w-0">
                  <div className="text-xs text-text-secondary">{LABELS[level]}</div>
                  <div
                    className={cn(
                      'truncate font-medium',
                      level !== 'nearestKVK' && 'capitalize',
                      !draft[level] && 'text-text-tertiary',
                    )}
                  >
                    {draft[level] || `Select ${LABELS[level]}`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!reason}
                  title={reason ? `Select ${LABELS[reason]} first` : `Edit ${LABELS[level]}`}
                  onClick={() => {
                    setSearch('');
                    setEditing(isEditing ? null : level);
                  }}
                  className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {isEditing && (
                <div className="mx-2 mb-2 rounded-lg border border-border-light">
                  <div className="flex items-center gap-2 border-b border-border-light px-2 py-1.5">
                    <Search className="h-4 w-4 text-text-secondary" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Search ${LABELS[level]}…`}
                      className="w-full bg-transparent outline-none placeholder:text-text-tertiary"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {loading[level] ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-text-secondary">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="px-3 py-2 text-text-secondary">No options found</div>
                    ) : (
                      filtered.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => pick(level, name)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-surface-hover"
                        >
                          <span className="break-words">{name}</span>
                          {same(name, draft[level]) && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="px-2 pb-1 text-xs text-red-500">{error}</p>}
      <div className="mt-1 flex justify-end gap-2 border-t border-border-light px-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 hover:bg-surface-hover"
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
          className="flex items-center gap-1.5 rounded-md bg-surface-submit px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
