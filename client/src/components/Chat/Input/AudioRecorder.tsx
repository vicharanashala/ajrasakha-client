import { useCallback, useEffect, useRef } from 'react';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
export default function AudioRecorder({
  disabled,
  ask,
  methods,
  textAreaRef,
  isSubmitting,
  enabled = false,
  onStopRecording,
  onListeningChange,
  onLoadingChange,
}: {
  disabled: boolean;
  ask: (data: { text: string }) => void;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
  enabled?: boolean;
  /** Called after the user manually stops recording, e.g. to switch the input UI back to text view. */
  onStopRecording?: () => void;
  /** Called whenever the listening state changes, e.g. to drive a "speaking now" animation elsewhere. */
  onListeningChange?: (isListening: boolean) => void;
  /** Called whenever the transcription-in-progress state changes, so callers can wait for the
   *  transcript to actually be ready (e.g. an external STT round-trip) before acting on stop. */
  onLoadingChange?: (isLoading: boolean) => void;
}) {
  const { setValue, reset, getValues } = methods;
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();

  const existingTextRef = useRef<string>('');

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (isSubmitting) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        /** For external STT, append existing text to the transcription */
        const finalText =
          isExternalSTT(speechToTextEndpoint) && existingTextRef.current
            ? `${existingTextRef.current} ${text}`
            : text;
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
      }
    },
    [ask, reset, showToast, localize, isSubmitting, speechToTextEndpoint],
  );

  const setText = useCallback(
    (text: string) => {
      let newText = text;
      if (isExternalSTT(speechToTextEndpoint)) {
        /** For external STT, the text comes as a complete transcription, so append to existing */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        /** For browser STT, the transcript is cumulative, so we only need to prepend the existing text once */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
    enabled,
  );

  useEffect(() => {
    onListeningChange?.(isListening === true);
  }, [isListening, onListeningChange]);

  useEffect(() => {
    onLoadingChange?.(isLoading === true);
  }, [isLoading, onLoadingChange]);

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    existingTextRef.current = getValues('text') || '';
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
    onStopRecording?.();
  };

  const renderIcon = () => {
    if (isListening === true) {
      return <ListeningIcon className="size-full stroke-emerald-400" />;
    }
    if (isLoading === true) {
      return <Spinner className="stroke-text-secondary" size={24} />;
    }
    return <ListeningIcon className="size-full stroke-text-secondary" />;
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_use_micrphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={isListening === true ? handleStopRecording : handleStartRecording}
          disabled={disabled || isLoading === true}
          className={cn(
            'relative flex size-14 items-center justify-center rounded-full border-2 p-2.5 transition-colors',
            // While listening — and still while transcribing right after, since that gap can
            // take a second or two — a translucent surface with a glowing emerald ring, so the
            // button reads as "busy" the whole time rather than snapping back to idle the
            // instant recording stops. Border, glow, and icon all use the same emerald-400
            // tone so the whole button reads as one color.
            isListening === true || isLoading === true
              ? 'border-emerald-400/70 bg-surface-primary/30'
              : 'border-border-heavy hover:bg-surface-hover',
          )}
          style={
            isListening === true || isLoading === true
              ? { animation: 'voice-mic-pulse 1.8s ease-in-out infinite' }
              : undefined
          }
          title={localize('com_ui_use_micrphone')}
          aria-pressed={isListening}
        >
          {(isListening === true || isLoading === true) && (
            <style>{`
              @keyframes voice-mic-pulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 8px 2px rgba(52, 211, 153, 0.4); }
                50% { transform: scale(1.04); box-shadow: 0 0 14px 4px rgba(52, 211, 153, 0.2); }
              }
            `}</style>
          )}
          <span className="relative z-10 flex size-full items-center justify-center">
            {renderIcon()}
          </span>
        </button>
      }
    />
  );
}
