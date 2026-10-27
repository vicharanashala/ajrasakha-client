import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { Calendar, BookOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import { useLocalize } from '~/hooks';
import AnswerNotFound from './AnswerNotFound';
import AnswerContent from './AnswerContent';
import MessageAudio from '~/components/Chat/Messages/MessageAudio';

interface AnswerData {
  question: string;
  answer: string;
  metadata?: {
    answeredBy?: string;
    sources?: string[];
    notices?: string[];
    disclaimers?: string[];
  };
}

type RawSource = string | Record<string, any>;

interface SourceDisplay {
  name: string;
  url: string;
  page: string;
}

// Extracts a display name, link and page from a source in either the old string or new object format.
function getSourceDisplay(source: RawSource): SourceDisplay {
  let name = '';
  let url = '';
  let page = '';

  if (typeof source === 'string') {
    const mdMatch = source.match(/^\[(.*?)\]\((.*?)\)$/);
    if (mdMatch) {
      name = mdMatch[1];
      url = mdMatch[2];
    } else {
      try {
        url = new URL(source).href;
      } catch {
        name = source;
      }
    }
  } else if (typeof source === 'object' && source !== null) {
    name = source.sourceName || source.name || source.title || '';
    url = source.source || source.url || source.link || '';
    page = source.page || '';
  }

  if (!name && url) {
    try {
      name = new URL(url).hostname.replace('www.', '');
    } catch {
      name = url;
    }
  }

  return { name: name || 'Unknown source', url, page: page ? String(page) : '' };
}

// Animated equalizer bars shown while the answer is being read aloud.
function SoundBars() {
  return (
    <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center gap-[3px]">
      {[0, 0.3, 0.15].map((delay) => (
        <span
          key={delay}
          className="h-4 w-[3px] origin-center animate-sound-bar rounded-full bg-current motion-reduce:animate-none motion-reduce:scale-y-75"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

// Formats a page value such as "1,2" or "3-5" as "Pages 1, 2" or "Pages 3-5".
function formatPages(page: string): string {
  const spaced = page.replace(/\s*,\s*/g, ', ').trim();
  return /[,\-–]/.test(spaced) ? `Pages ${spaced}` : `Page ${spaced}`;
}

export default function AnswerPage() {
  const { messageId } = useParams<{ messageId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthContext();
  const localize = useLocalize();
  
  const [data, setData] = useState<AnswerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'not-found' | 'error'>('idle');

  // Loads the answer and distinguishes a missing answer from a failed request.
  const fetchData = useCallback(async () => {
    if (!messageId) {
      setLoading(false);
      setStatus('not-found');
      return;
    }

    try {
      setLoading(true);
      setStatus('idle');
      const res = await fetch(`/api/answers/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setStatus(res.status === 404 ? 'not-found' : 'error');
        return;
      }

      const jsonData = await res.json();
      if (!jsonData) {
        setStatus('not-found');
        return;
      }
      setData(jsonData);
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [messageId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stops reading aloud when the user leaves this answer, for both browser and external voices.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      const audio = document.getElementById(`audio-${messageId}`) as HTMLAudioElement | null;
      audio?.pause();
    };
  }, [messageId]);

  if (loading) {
    return (
      <div
        role="status"
        className="flex h-full w-full items-center justify-center bg-surface-primary"
      >
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-border-medium border-t-green-500"
          />
          {localize('com_ui_loading')}
        </div>
      </div>
    );
  }

  if (status !== 'idle' || !data) {
    return (
      <AnswerNotFound variant={status === 'error' ? 'error' : 'not-found'} onRetry={fetchData} />
    );
  }

  const localizedTitle = localize('com_ui_your_question_is_answered');
  const displayTitle = localizedTitle === 'com_ui_your_question_is_answered' ? 'Your question is answered' : localizedTitle;
  const userName = user?.name || user?.username || 'You';
  const expertName = data.metadata?.answeredBy || 'Expert';
  const sources = data.metadata?.sources ?? [];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-primary">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-5 sm:gap-8 sm:px-6 sm:py-8 lg:max-w-5xl lg:px-4 lg:py-10 2xl:max-w-6xl">
        <header className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="-ml-2 flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {localize('com_ui_back_to_chat')}
          </button>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{displayTitle}</h1>
            <p className="flex items-center gap-2 text-sm text-text-tertiary">
              <Calendar className="size-4" aria-hidden="true" />
              {today}
            </p>
          </div>
        </header>

        {/* Question */}
        <section
          aria-label="Your question"
          className="flex items-start gap-3 rounded-2xl border border-border-light bg-surface-secondary p-4 sm:gap-4 sm:p-5"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-sm font-semibold uppercase text-text-primary"
          >
            {userName.charAt(0)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">{userName}</span>
            <p className="whitespace-pre-wrap break-words text-base text-text-primary sm:text-lg">
              {data.question}
            </p>
          </div>
        </section>

        {/* Answer */}
        <article
          aria-label="Expert answer"
          className="rounded-2xl border border-border-light bg-surface-primary p-4 shadow-sm sm:p-6 lg:px-5 lg:py-8"
        >
          <div className="mb-6 flex items-center gap-3 border-b border-border-light pb-4">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-500/10">
              <img src="/assets/annam-logo.png" alt="" className="size-6 object-contain" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-text-primary">{expertName}</span>
              <span className="text-xs text-text-tertiary">Expert answer</span>
            </div>
            {/* Reads the answer aloud using the app's text to speech settings. */}
            {messageId && (
              <div className="ml-auto shrink-0">
                <MessageAudio
                  index={0}
                  messageId={messageId}
                  content={data.answer}
                  renderButton={({ onClick, title, icon, isActive }) => (
                    <button
                      type="button"
                      onClick={onClick}
                      aria-label={title}
                      aria-pressed={isActive}
                      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${
                        isActive
                          ? 'border-green-500/40 bg-green-500/10 text-green-500 dark:text-green-400'
                          : 'border-border-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      {isActive ? <SoundBars /> : icon}
                      <span className="hidden sm:inline">{title}</span>
                    </button>
                  )}
                />
              </div>
            )}
          </div>

          <AnswerContent answer={data.answer} />
        </article>

        {/* Sources */}
        {sources.length > 0 && (
          <section aria-labelledby="answer-sources" className="flex flex-col gap-3">
            <h2 id="answer-sources" className="text-lg font-semibold text-text-primary">
              Sources
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sources.map((source, idx) => {
                const { name, url, page } = getSourceDisplay(source);
                const content = (
                  <>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500 dark:text-green-400">
                      <BookOpen className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span
                        title={name}
                        className="line-clamp-3 w-full [overflow-wrap:anywhere] text-sm font-semibold text-text-primary sm:text-base"
                      >
                        {name}
                      </span>
                      {page && (
                        <span className="rounded-md bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {formatPages(page)}
                        </span>
                      )}
                    </span>
                    {url && (
                      <ExternalLink
                        className="size-4 shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </>
                );
                // Underline is switched off because a global link style would otherwise underline the whole card.
                const cardClass =
                  'group flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border-light bg-surface-secondary p-3 no-underline transition-colors sm:p-4 [&_*]:no-underline';
                return (
                  <li key={idx} className="min-w-0">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${cardClass} hover:border-border-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary`}
                      >
                        {content}
                      </a>
                    ) : (
                      <div className={cardClass}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
