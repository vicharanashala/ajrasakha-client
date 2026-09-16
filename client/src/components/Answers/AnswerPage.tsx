import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { Calendar, User, BookOpen, ArrowLeft } from 'lucide-react';
import { useLocalize } from '~/hooks';

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

export default function AnswerPage() {
  const { messageId } = useParams<{ messageId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthContext();
  const localize = useLocalize();
  
  const [data, setData] = useState<AnswerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!messageId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/answers/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          if (res.status === 404) throw new Error(localize('com_ui_answer_not_found') || 'Answer not found');
          throw new Error(localize('com_ui_failed_to_fetch_answer') || 'Failed to fetch answer');
        }
        
        const jsonData = await res.json();
        setData(jsonData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, token]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">{localize('com_ui_loading') || 'Loading...'}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-4">
        <div className="text-red-500">{error || localize('com_ui_answer_not_found') || 'Answer not found'}</div>
        <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">
          {localize('com_ui_go_back_home') || 'Go back home'}
        </button>
      </div>
    );
  }

  const createMarkup = (htmlString: string) => {
    return { __html: htmlString };
  };

  const localizedTitle = localize('com_ui_your_question_is_answered');
  const displayTitle = localizedTitle === 'com_ui_your_question_is_answered' ? 'Your question is answered' : localizedTitle;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col p-4 sm:p-6 lg:p-8">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {localize('com_ui_back_to_chat') || 'Back to Chat'}
        </button>

        {/* Header Card */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayTitle}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex flex-col gap-8">
          
          {/* User Question */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-500 text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-900 dark:text-white">{user?.name || user?.username || 'User'}</span>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {data.question}
              </div>
            </div>
          </div>

          {/* Expert Answer */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden">
              <img src="/assets/logo.svg" alt="Annam Leafy Logo" className="h-full w-full object-contain" />
            </div>
            
            <div className="flex flex-col gap-1 w-full max-w-full">
              <span className="font-semibold text-gray-900 dark:text-white">{data.metadata?.answeredBy || 'Expert'}</span>
              
              {/* Answer Content */}
              <div 
                className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mt-2"
                dangerouslySetInnerHTML={createMarkup(data.answer)}
              />

              {/* Metadata Block */}
              {data.metadata && (
                <div className="mt-8 flex flex-col gap-4 rounded-xl bg-gray-50 p-5 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
                  
                  {data.metadata.answeredBy && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <User className="h-4 w-4 text-blue-500" />
                      <span>Answered by: <strong>{data.metadata.answeredBy}</strong></span>
                    </div>
                  )}

                  {data.metadata.sources && data.metadata.sources.length > 0 && (
                    <div className="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100">Sources</span>
                      <hr className="border-gray-200 dark:border-gray-700 mb-2" />
                      
                      <div className="flex flex-col gap-3">
                        {data.metadata.sources.map((source: any, idx) => {
                          let name = '';
                          let url = '';
                          let page = '';

                          if (typeof source === 'string') {
                            // Fallback for old string format
                            const mdMatch = source.match(/^\[(.*?)\]\((.*?)\)$/);
                            if (mdMatch) {
                              name = mdMatch[1];
                              url = mdMatch[2];
                            } else {
                              try {
                                const parsedUrl = new URL(source);
                                name = parsedUrl.hostname.replace('www.', '');
                                url = source;
                              } catch (e) {
                                name = source;
                              }
                            }
                          } else if (typeof source === 'object' && source !== null) {
                            // New object format
                            name = source.sourceName || source.name || source.title || '';
                            url = source.source || source.url || source.link || '';
                            page = source.page || '';
                          }

                          // If name is empty but we have a url, fallback to domain name
                          if (!name && url) {
                            try {
                              const parsedUrl = new URL(url);
                              name = parsedUrl.hostname.replace('www.', '');
                            } catch (e) {
                              name = url;
                            }
                          }

                          return (
                            <div key={idx} className="flex flex-col gap-1 p-4 rounded-xl bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 transition-colors">
                              <div className="flex items-start gap-2">
                                <BookOpen className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
                                {url ? (
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="font-semibold text-gray-900 dark:text-gray-100 hover:underline break-all"
                                  >
                                    {name || 'Unknown Source'}
                                  </a>
                                ) : (
                                  <span className="font-semibold text-gray-900 dark:text-gray-100 break-all">
                                    {name || 'Unknown Source'}
                                  </span>
                                )}
                              </div>
                              {page && (
                                <div className="pl-6 text-xs text-gray-500 dark:text-gray-400">
                                  Page: {page}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
