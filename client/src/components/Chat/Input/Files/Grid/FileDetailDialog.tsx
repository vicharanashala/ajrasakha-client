import { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { Database, Download } from 'lucide-react';
import { FileSources, FileContext } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  FileIcon,
  TrashIcon,
  Spinner,
  OpenAIMinimalIcon,
  AzureMinimalIcon,
  useToastContext,
} from '@librechat/client';
import { useDeleteFilesFromTable } from '~/hooks/Files';
import { useFileDownload } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize, TranslationKeys } from '~/hooks';
import { getFileType, formatDate, cn } from '~/utils';
import { formatFileSize } from './utils';
import store from '~/store';

const contextMap: Record<any, TranslationKeys> = {
  [FileContext.avatar]: 'com_ui_avatar',
  [FileContext.unknown]: 'com_ui_unknown',
  [FileContext.assistants]: 'com_ui_assistants',
  [FileContext.image_generation]: 'com_ui_image_gen',
  [FileContext.assistants_output]: 'com_ui_assistants_output',
  [FileContext.message_attachment]: 'com_ui_attachment',
};

export default function FileDetailDialog({
  file,
  onOpenChange,
}: {
  file: TFile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const setFiles = useSetRecoilState(store.filesByIndex(0));
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { deleteFiles } = useDeleteFilesFromTable(() => {
    setIsDeleting(false);
    onOpenChange(false);
  });
  const { refetch: downloadFile, isFetching: isDownloading } = useFileDownload(
    user?.id ?? '',
    file?.file_id,
  );

  const handleClose = (open: boolean) => {
    if (!open) {
      setConfirmingDelete(false);
    }
    onOpenChange(open);
  };

  const handleDownload = async () => {
    if (!file) {
      return;
    }
    try {
      const stream = await downloadFile();
      if (stream.data == null || stream.data === '') {
        showToast({ status: 'error', message: localize('com_ui_download_error') });
        return;
      }
      const link = document.createElement('a');
      link.href = stream.data as string;
      link.setAttribute('download', file.filename ?? 'file');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(stream.data as string);
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast({ status: 'error', message: localize('com_ui_download_error') });
    }
  };

  const handleDelete = () => {
    if (!file) {
      return;
    }
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setIsDeleting(true);
    deleteFiles({ files: [file], setFiles });
  };

  const isImage = file?.type?.startsWith('image');
  const fileType = file && !isImage ? getFileType(file.type) : undefined;
  const sourceLabel = !file
    ? ''
    : file.source === FileSources.openai
      ? 'OpenAI'
      : file.source === FileSources.azure
        ? 'Azure'
        : localize('com_ui_host');

  return (
    <OGDialog open={!!file} onOpenChange={handleClose}>
      <OGDialogContent className="w-11/12 max-w-sm gap-3 bg-background p-4 text-text-primary shadow-2xl sm:max-w-md sm:gap-4 sm:p-6">
        {file && (
          <>
            <OGDialogHeader>
              <OGDialogTitle className="truncate pr-6 text-base sm:text-lg">
                {file.filename}
              </OGDialogTitle>
            </OGDialogHeader>

            <div className="flex flex-col gap-3 sm:gap-4">
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl border border-border-light bg-surface-secondary',
                  isImage ? 'p-2 sm:p-3' : 'p-4 sm:p-6',
                )}
              >
                {isImage ? (
                  // object-contain preserves the image's own aspect ratio (portrait or
                  // landscape) while the max-height/width caps keep it within the viewport.
                  <img
                    src={file.filepath}
                    alt={file.filename}
                    className="max-h-[40vh] w-full max-w-full rounded-lg object-contain sm:max-h-[50vh]"
                  />
                ) : (
                  fileType && (
                    <div className="scale-125 sm:scale-150">
                      <FileIcon file={file} fileType={fileType} />
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                    {localize('com_ui_size')}
                  </span>
                  <span className="text-text-primary">{formatFileSize(file.bytes)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                    {localize('com_ui_date')}
                  </span>
                  <span className="text-text-primary">
                    {formatDate(file.updatedAt?.toString() ?? '')}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                    {localize('com_ui_storage')}
                  </span>
                  <span className="flex items-center gap-1.5 text-text-primary">
                    {file.source === FileSources.openai ? (
                      <OpenAIMinimalIcon className="icon-sm text-green-600/50" />
                    ) : file.source === FileSources.azure ? (
                      <AzureMinimalIcon className="icon-sm text-cyan-700" />
                    ) : (
                      <Database className="icon-sm text-cyan-700" aria-hidden="true" />
                    )}
                    {sourceLabel}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-text-secondary">
                    {localize('com_ui_context')}
                  </span>
                  <span className="text-text-primary">
                    {localize(contextMap[file.context ?? FileContext.unknown])}
                  </span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border-light pt-3 sm:flex-row sm:justify-end">
                {confirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover sm:w-auto"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto',
                    confirmingDelete
                      ? 'border-surface-destructive bg-surface-destructive text-white hover:bg-surface-destructive-hover'
                      : 'border-border-heavy bg-surface-secondary text-text-primary hover:bg-surface-hover',
                  )}
                >
                  {isDeleting ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <TrashIcon
                      className={cn('size-3.5', confirmingDelete ? 'text-white' : 'text-red-400')}
                    />
                  )}
                  {isDeleting ? localize('com_ui_deleting_file') : localize('com_ui_delete')}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-submit px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isDownloading ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {localize('com_ui_download')}
                </button>
              </div>
            </div>
          </>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
