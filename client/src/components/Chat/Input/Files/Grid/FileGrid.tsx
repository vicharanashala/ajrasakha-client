import { useMemo, useState } from 'react';
import type { TFile } from 'librechat-data-provider';
import { FilterInput, FileIcon } from '@librechat/client';
import SourceIcon from '~/components/Chat/Input/Files/SourceIcon';
import { useLocalize } from '~/hooks';
import { getFileType } from '~/utils';
import FileDetailDialog from './FileDetailDialog';
import { formatFileSize } from './utils';

export default function FileGrid({ files }: { files: TFile[] }) {
  const localize = useLocalize();
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<TFile | null>(null);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return files;
    }
    return files.filter((file) => (file.filename ?? '').toLowerCase().includes(query));
  }, [files, search]);

  return (
    <div className="flex h-full flex-col gap-3">
      <FilterInput
        inputId="files-filter"
        label={localize('com_files_filter')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        containerClassName="w-full"
      />
      <div className="max-h-[65vh] min-h-[50vh] flex-1 overflow-y-auto rounded-md border border-black/10 p-2 dark:border-white/10 sm:max-h-[calc(100vh-20rem)] sm:min-h-[calc(100vh-20rem)] sm:p-3">
        {filteredFiles.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredFiles.map((file) => {
              const isImage = file.type?.startsWith('image');
              const fileType = !isImage ? getFileType(file.type) : undefined;
              return (
                <button
                  key={file.file_id}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary text-left transition-colors hover:border-border-heavy hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
                >
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-surface-secondary">
                    {isImage ? (
                      <img
                        src={file.filepath}
                        alt={file.filename}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      fileType && <FileIcon file={file} fileType={fileType} />
                    )}
                    <SourceIcon
                      source={file.source}
                      isCodeFile={!!file?.['metadata']?.fileIdentifier}
                      className="absolute bottom-1.5 right-1.5 rounded-full p-[0.2rem] text-gray-600"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 px-2 py-2">
                    <span className="truncate text-xs font-medium text-text-primary sm:text-sm">
                      {file.filename}
                    </span>
                    <span className="truncate text-[10px] text-text-secondary sm:text-xs">
                      {formatFileSize(file.bytes)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-text-secondary">
            {localize('com_files_no_results')}
          </div>
        )}
      </div>
      <FileDetailDialog
        file={selectedFile}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFile(null);
          }
        }}
      />
    </div>
  );
}
