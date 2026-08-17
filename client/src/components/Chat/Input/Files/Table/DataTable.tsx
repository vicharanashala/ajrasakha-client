import { useState, useCallback, useEffect, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import {
  flexRender,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { FileContext } from 'librechat-data-provider';
import {
  Table,
  Button,
  Spinner,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TrashIcon,
  FilterInput,
  TableHeader,
  useMediaQuery,
} from '@librechat/client';
import type { TFile } from 'librechat-data-provider';
import { ColumnVisibilityDropdown } from './ColumnVisibilityDropdown';
import { useDeleteFilesFromTable } from '~/hooks/Files';
import { useLocalize, TranslationKeys } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const contextMap: Record<string, TranslationKeys> = {
  [FileContext.filename]: 'com_ui_name',
  [FileContext.updatedAt]: 'com_ui_date',
  [FileContext.filterSource]: 'com_ui_storage',
  [FileContext.context]: 'com_ui_context',
  [FileContext.bytes]: 'com_ui_size',
};

type Style = {
  width?: number | string;
  maxWidth?: number | string;
  minWidth?: number | string;
  zIndex?: number;
};

// Half of a full crossfade: the content fades out over this long, then the page data
// swaps while invisible, then it fades back in over the same duration.
const PAGE_TRANSITION_MS = 150;

export default function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const localize = useLocalize();
  const [isDeleting, setIsDeleting] = useState(false);
  const setFiles = useSetRecoilState(store.filesByIndex(0));
  const { deleteFiles } = useDeleteFilesFromTable(() => setIsDeleting(false));

  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const pageTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      minSize: 0,
      size: Number.MAX_SAFE_INTEGER,
      maxSize: Number.MAX_SAFE_INTEGER,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const changePage = useCallback(
    (direction: 'previous' | 'next') => {
      if (pageTransitionTimeout.current) {
        clearTimeout(pageTransitionTimeout.current);
      }
      setIsPageTransitioning(true);
      pageTransitionTimeout.current = setTimeout(() => {
        if (direction === 'previous') {
          table.previousPage();
        } else {
          table.nextPage();
        }
        setIsPageTransitioning(false);
        pageTransitionTimeout.current = null;
      }, PAGE_TRANSITION_MS);
    },
    [table],
  );

  useEffect(() => {
    return () => {
      if (pageTransitionTimeout.current) {
        clearTimeout(pageTransitionTimeout.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 py-2 sm:gap-4 sm:py-4">
        <Button
          variant="outline"
          onClick={() => {
            setIsDeleting(true);
            const filesToDelete = table
              .getFilteredSelectedRowModel()
              .rows.map((row) => row.original);
            deleteFiles({ files: filesToDelete as TFile[], setFiles });
            setRowSelection({});
          }}
          disabled={!table.getFilteredSelectedRowModel().rows.length || isDeleting}
          className={cn('min-w-[40px] transition-all duration-200', isSmallScreen && 'px-2 py-1')}
        >
          {isDeleting ? (
            <Spinner className="size-3.5 sm:size-4" />
          ) : (
            <TrashIcon className="size-3.5 text-red-400 sm:size-4" />
          )}
          {!isSmallScreen && <span className="ml-2">{localize('com_ui_delete')}</span>}
        </Button>
        <FilterInput
          inputId="files-filter"
          label={localize('com_files_filter')}
          value={(table.getColumn('filename')?.getFilterValue() as string | undefined) ?? ''}
          onChange={(event) => table.getColumn('filename')?.setFilterValue(event.target.value)}
          containerClassName="flex-1"
        />
        <div className="relative focus-within:z-[100]">
          <ColumnVisibilityDropdown
            table={table}
            contextMap={contextMap}
            isSmallScreen={isSmallScreen}
          />
        </div>
      </div>
      {isSmallScreen ? (
        <div className="flex h-full max-h-[calc(100vh-20rem)] min-h-[calc(100vh-20rem)] w-full flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-black/10 p-2 dark:border-white/10">
          <div
            className={cn(
              'flex flex-col gap-2 transition-opacity duration-150 ease-in-out',
              isPageTransitioning ? 'opacity-0' : 'opacity-100',
            )}
          >
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const cells = row.getVisibleCells();
                const selectCell = cells.find((cell) => cell.column.id === 'select');
                const filenameCell = cells.find((cell) => cell.column.id === 'filename');
                const detailCells = cells.filter(
                  (cell) => cell.column.id !== 'select' && cell.column.id !== 'filename',
                );

                return (
                  <div
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="flex flex-col gap-3 rounded-lg border border-border-light bg-surface-primary p-3 transition-colors data-[state=selected]:bg-surface-secondary [tr[data-disabled=true]_&]:opacity-50"
                  >
                    <div className="flex items-start gap-2.5">
                      {selectCell && (
                        <div className="flex shrink-0 items-center pt-1">
                          {flexRender(selectCell.column.columnDef.cell, selectCell.getContext())}
                        </div>
                      )}
                      {filenameCell && (
                        <div className="min-w-0 flex-1 text-sm text-text-primary">
                          {flexRender(
                            filenameCell.column.columnDef.cell,
                            filenameCell.getContext(),
                          )}
                        </div>
                      )}
                    </div>
                    {detailCells.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-light pt-2 text-xs">
                        {detailCells.map((cell) => (
                          <div key={cell.id} className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                              {localize(contextMap[cell.column.id])}
                            </span>
                            <span className="truncate text-text-primary">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-text-secondary">
                {localize('com_files_no_results')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative grid h-full max-h-[calc(100vh-20rem)] min-h-[calc(100vh-20rem)] w-full flex-1 overflow-hidden overflow-x-auto overflow-y-auto rounded-md border border-black/10 dark:border-white/10">
          <Table className="w-full min-w-[300px] border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-border-light">
                  {headerGroup.headers.map((header, _index) => {
                    const size = header.getSize();
                    const style: Style = {
                      width: size === Number.MAX_SAFE_INTEGER ? 'auto' : size,
                    };

                    return (
                      <TableHead
                        key={header.id}
                        className="whitespace-nowrap bg-surface-secondary px-2 py-2 text-left text-sm font-medium text-text-secondary sm:px-4"
                        style={{ ...style }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody
              className={cn(
                'w-full transition-opacity duration-150 ease-in-out',
                isPageTransitioning ? 'opacity-0' : 'opacity-100',
              )}
            >
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="border-b border-border-light transition-colors hover:bg-surface-secondary [tr:last-child_&]:border-b-0"
                  >
                    {row.getVisibleCells().map((cell, _index) => {
                      const size = cell.column.getSize();
                      const style: Style = {
                        width: size === Number.MAX_SAFE_INTEGER ? 'auto' : size,
                      };

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'align-start px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm [tr[data-disabled=true]_&]:opacity-50',
                            cell.column.id === 'select' ? 'overflow-visible' : 'overflow-x-auto',
                          )}
                          style={style}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {localize('com_files_no_results')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 py-2 sm:py-4">
        <div className="ml-2 flex-1 truncate text-xs text-muted-foreground sm:ml-4 sm:text-sm">
          <span className="hidden sm:inline">
            {localize('com_files_number_selected', {
              0: `${table.getFilteredSelectedRowModel().rows.length}`,
              1: `${table.getFilteredRowModel().rows.length}`,
            })}
          </span>
          <span className="sm:hidden">
            {`${table.getFilteredSelectedRowModel().rows.length}/${
              table.getFilteredRowModel().rows.length
            }`}
          </span>
        </div>
        <div className="flex items-center space-x-1 pr-2 text-xs font-bold text-text-primary sm:text-sm">
          <span className="hidden sm:inline">{localize('com_ui_page')}</span>
          <span>{table.getState().pagination.pageIndex + 1}</span>
          <span>/</span>
          <span>{Math.max(table.getPageCount(), 1)}</span>
        </div>
        <Button
          className="select-none"
          variant="outline"
          size="sm"
          onClick={() => changePage('previous')}
          disabled={!table.getCanPreviousPage() || isPageTransitioning}
        >
          {localize('com_ui_prev')}
        </Button>
        <Button
          className="select-none"
          variant="outline"
          size="sm"
          onClick={() => changePage('next')}
          disabled={!table.getCanNextPage() || isPageTransitioning}
        >
          {localize('com_ui_next')}
        </Button>
      </div>
    </div>
  );
}
