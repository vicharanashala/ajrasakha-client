import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { Calendar, User, BookOpen, AlertTriangle, Settings, ArrowLeft } from 'lucide-react';

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
          if (res.status === 404) throw new Error('Answer not found');
          throw new Error('Failed to fetch answer');
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
  }, [messageId, token]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-4">
        <div className="text-red-500">{error || 'Answer not found'}</div>
        <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">
          Go back home
        </button>
      </div>
    );
  }

  // A simple markdown renderer for the answer text (since it might contain markdown or HTML)
  // For safety, you might want to use react-markdown or DOMPurify, but for this implementation
  // we'll render it safely if it's text, or dangerouslySetInnerHTML if it's HTML.
  // Assuming it's simple text with some HTML for now, or just text.
  const createMarkup = (htmlString: string) => {
    return { __html: htmlString };
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col p-4 sm:p-6 lg:p-8">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Chat
        </button>

        {/* Header Card */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your question is answered</h1>
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              {/* Using a simple circular icon for AjraSakha Agent */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
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
                <div className="mt-8 flex flex-col gap-4 rounded-xl bg-gray-100 p-5 dark:bg-gray-800/50">
                  
                  {data.metadata.answeredBy && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <User className="h-4 w-4 text-blue-500" />
                      <span>Answered by: <strong>{data.metadata.answeredBy}</strong></span>
                    </div>
                  )}

                  {data.metadata.sources && data.metadata.sources.length > 0 && (
                    <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">Sources:</span>
                      </div>
                      <div className="pl-6 flex flex-wrap gap-2">
                        {data.metadata.sources.map((source, idx) => (
                          <span key={idx} className="text-blue-600 hover:underline cursor-pointer dark:text-blue-400 font-medium">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(data.metadata.notices && data.metadata.notices.length > 0) && (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-4">
                      {data.metadata.notices.map((notice, idx) => (
                         <div key={idx} className="flex flex-col gap-2">
                           <div className="font-semibold text-yellow-600 flex items-center gap-2">
                             <AlertTriangle className="h-4 w-4" />
                             ⚠️ {notice.includes('Notice') ? notice : `Important Notice`} ⚠️
                           </div>
                           <p className="text-sm">{notice}</p>
                         </div>
                      ))}
                    </div>
                  )}
                  
                  {(data.metadata.disclaimers && data.metadata.disclaimers.length > 0) && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-1">
                      {data.metadata.disclaimers.map((disc, idx) => (
                        <p key={idx}>{disc}</p>
                      ))}
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
