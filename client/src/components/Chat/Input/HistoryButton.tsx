import { useState, useRef, useEffect, memo } from 'react';
import { useGetUserMessageHistoryQuery } from 'librechat-data-provider/react-query';
import { Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';

function HistoryButton({ onSelect }: { onSelect: (text: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const localize = useLocalize();

  const { data, isLoading } = useGetUserMessageHistoryQuery(
    { pageSize: 20 },
    { enabled: isOpen }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="btn relative p-0 text-black focus:ring-0 focus:ring-offset-0 dark:text-white"
        aria-label="Recent Queries History"
        title="Recent Queries History"
        style={{
          margin: 0,
          background: 'transparent',
          height: '2.5rem',
          width: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 sm:w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-all dark:border-gray-600 dark:bg-gray-800">
          <div className="px-4 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600">
            Recent Queries
          </div>
          <div className="max-h-[22.5rem] overflow-y-auto p-1 scrollbar-hover">
            {isLoading ? (
              <div className="flex h-20 items-center justify-center text-text-primary">
                <Spinner />
              </div>
            ) : data?.messages?.length ? (
              data.messages.map((msg) => (
                <button
                  key={msg.messageId}
                  type="button"
                  onClick={() => {
                    onSelect(msg.text);
                    setIsOpen(false);
                  }}
                  className="w-full truncate rounded-lg px-3 py-2.5 mb-1 text-left text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-black dark:hover:text-white focus:bg-gray-200 dark:focus:bg-gray-700 focus:outline-none transition-all duration-200"
                  title={msg.text}
                >
                  {msg.text}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-text-secondary">
                No recent queries found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(HistoryButton);
