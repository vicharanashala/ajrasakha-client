import { useCallback, useEffect, useRef } from 'react';
import { useToastContext, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';
import VoiceOrb from './VoiceOrb';

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
    // While listening the volume-driven orb (rendered on the button) is the indicator, so the
    // glyph is dropped.
    if (isListening === true) {
      return null;
    }
    // White glyph in both themes: the button underneath is always the solid green fill,
    // so the icon colour follows the button, not the page theme.
    if (isLoading === true) {
      return <Spinner color="#fff" size={28} />;
    }
    return <ListeningIcon className="size-full stroke-white" />;
  };

  return (
    <button
      id="audio-recorder"
      type="button"
      aria-label={localize('com_ui_use_micrphone')}
      onClick={isListening === true ? handleStopRecording : handleStartRecording}
      disabled={disabled || isLoading === true}
      className={cn(
        // Solid green "ready" circle at rest. While listening the fill disappears and the
        // volume-driven orb takes over, so the button is only a transparent tap target.
        'relative flex size-20 items-center justify-center rounded-full bg-green-500 p-2 sm:size-16 transition-all duration-300 disabled:opacity-50',
        isListening === true
          ? 'bg-transparent hover:bg-transparent'
          : isLoading === true
            ? 'bg-emerald-400'
            : 'hover:bg-green-400',
      )}
      style={{
        boxShadow:
          isListening === true
            ? 'none'
            : isLoading === true
              ? '0 0 10px 2px rgba(117, 215, 178, 0.4)'
              : '0 0 8px 1px rgba(25, 135, 84, 0.3)',
        animation: isLoading === true ? 'voice-mic-pulse 1.8s ease-in-out infinite' : undefined,
      }}
      aria-pressed={isListening}
    >
      <style>{`
        @keyframes voice-mic-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 10px 2px rgba(117, 215, 178, 0.4); }
          50% { transform: scale(1.03); box-shadow: 0 0 14px 3px rgba(117, 215, 178, 0.22); }
        }
      `}</style>
      {isListening === true && <VoiceOrb />}
      <span className="relative z-10 flex size-8 items-center justify-center sm:size-6">
        {renderIcon()}
      </span>
    </button>
  );
}
