import { useCallback, useEffect, useRef } from 'react';
import { useToastContext, ListeningIcon, Spinner } from '@librechat/client';
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
      // Live equalizer bars in place of the mic glyph while actively recording. Each bar is
      // offset from the last, so the peak travels across them like a passing waveform —
      // reads as sound arriving over time, which is what recording actually is.
      return (
        <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
          <style>{`
            @keyframes voice-mic-wave {
              0%, 100% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              .voice-mic-wave-bar { animation: none !important; transform: scaleY(0.7); }
            }
          `}</style>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="voice-mic-wave-bar h-full w-[3px] rounded-full bg-white"
              style={{
                // Center-anchored, not bottom-anchored: top and bottom both draw in toward
                // the middle as the bar shrinks, instead of the bottom staying fixed.
                transformOrigin: 'center',
                animation: `voice-mic-wave 1.1s ease-in-out ${i * 0.13}s infinite`,
              }}
            />
          ))}
        </span>
      );
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
        // Solid green "ready" circle at rest, not just an outline — this is the button's
        // default look (matches the always-on glowing mic treatment), not something that
        // only appears once recording starts. Listening bumps the glow up a notch so
        // there's still a visible state change when it's actually capturing audio.
        'relative flex size-16 items-center justify-center rounded-full bg-green-500 p-2 transition-all duration-300 disabled:opacity-50',
        isListening === true || isLoading === true
          ? 'bg-emerald-400'
          : 'hover:bg-green-400',
      )}
      style={{
        boxShadow:
          isListening === true || isLoading === true
            ? '0 0 10px 2px rgba(117, 215, 178, 0.4)'
            : '0 0 8px 1px rgba(25, 135, 84, 0.3)',
        animation:
          isListening === true || isLoading === true
            ? 'voice-mic-pulse 1.8s ease-in-out infinite'
            : undefined,
      }}
      aria-pressed={isListening}
    >
      <style>{`
        @keyframes voice-mic-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 10px 2px rgba(117, 215, 178, 0.4); }
          50% { transform: scale(1.03); box-shadow: 0 0 14px 3px rgba(117, 215, 178, 0.22); }
        }
      `}</style>
      <span className="relative z-10 flex size-6 items-center justify-center">
        {renderIcon()}
      </span>
    </button>
  );
}
