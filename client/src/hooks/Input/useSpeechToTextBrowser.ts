import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import useGetAudioSettings from './useGetAudioSettings';
import { useLocalize } from '~/hooks';
import store from '~/store';

const useSpeechToTextBrowser = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  enabled = false,
) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isBrowserSTTEnabled = speechToTextEndpoint === 'browser';
  const { data: speechConfig } = useGetCustomConfigSpeechQuery({ enabled: true });
  const sttExternal = Boolean(speechConfig?.sttExternal);

  const [speechError, setSpeechError] = useState<string | undefined>(undefined);
  const lastTranscript = useRef<string | null>(null);
  const lastInterim = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>();
  /** True for the brief window between the recognizer ending and its final transcript
   *  arriving. Most desktop browsers stream `interimTranscript` live, so there's nothing to
   *  wait on — but some mobile/embedded WebViews only ever deliver one result at the very
   *  end, so the user taps stop and sees nothing until the finished text suddenly appears.
   *  This drives the same "Converting speech to text…" state the external-STT engine already
   *  shows (see AudioRecorder.tsx / ChatForm.tsx's isTranscribing), so both engines give the
   *  same feedback instead of the browser engine silently doing nothing. */
  const [isFinalizing, setIsFinalizing] = useState(false);
  const wasListeningRef = useRef(false);
  const finalizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearFinalizeTimeout = useCallback(() => {
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  }, []);
  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [autoTranscribeAudio] = useRecoilState<boolean>(store.autoTranscribeAudio);

  const {
    listening,
    finalTranscript,
    resetTranscript,
    interimTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const isListening = useMemo(() => listening, [listening]);

  // Recording just stopped (tapped by the user or auto-ended by the recognizer on silence).
  // Flag the gap until a final transcript actually lands — cleared below as soon as it does,
  // on a recognition error, or after a few seconds if neither ever happens (a silent/empty
  // recording), so the "converting" state can't get stuck on forever.
  //
  // Skipped when the transcript was already streamed in live before listening stopped (the
  // normal desktop-browser case, interimTranscript updating the whole time) — otherwise this
  // flags isFinalizing on every stop unconditionally, and since the finalTranscript effect
  // below bails out early when the transcript hasn't changed, nothing would ever clear it
  // until the 4s fallback: a spinner flash on every recording, even ones with no real gap.
  useEffect(() => {
    const alreadyHaveFinal =
      finalTranscript != null && finalTranscript !== '' && lastTranscript.current === finalTranscript;
    if (wasListeningRef.current && !listening && !alreadyHaveFinal) {
      setIsFinalizing(true);
      clearFinalizeTimeout();
      finalizeTimeoutRef.current = setTimeout(() => setIsFinalizing(false), 4000);
    }
    wasListeningRef.current = listening;
  }, [listening, finalTranscript, clearFinalizeTimeout]);

  useEffect(() => {
    if (!enabled) {
      lastTranscript.current = finalTranscript;
      return;
    }

    if (!interimTranscript) return;

    if (lastTranscript.current === finalTranscript) {
      return;
    }

    if (interimTranscript == null || interimTranscript === '') {
      return;
    }

    if (lastInterim.current === interimTranscript) {
      return;
    }

    setText(interimTranscript);
    lastInterim.current = interimTranscript;
  }, [enabled, setText, interimTranscript, finalTranscript]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (finalTranscript == null || finalTranscript === '') {
      return;
    }

    if (lastTranscript.current === finalTranscript) {
      return;
    }

    setText(finalTranscript);
    lastTranscript.current = finalTranscript;
    clearFinalizeTimeout();
    setIsFinalizing(false);
    if (autoSendText > -1 && finalTranscript.length > 0) {
      timeoutRef.current = setTimeout(() => {
        onTranscriptionComplete(finalTranscript);
        resetTranscript();
      }, autoSendText * 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    enabled,
    setText,
    onTranscriptionComplete,
    resetTranscript,
    finalTranscript,
    autoSendText,
    clearFinalizeTimeout,
  ]);

  const toggleListening = useCallback(() => {
    setSpeechError(undefined);
    if (!browserSupportsSpeechRecognition) {
      const msg = sttExternal
        ? localize('com_ui_speech_not_supported_use_external')
        : localize('com_ui_speech_not_supported');
      showToast({
        message: msg,
        status: 'error',
      });
      setSpeechError(msg);
      return;
    }

    if (!isMicrophoneAvailable) {
      const msg = localize('com_ui_microphone_unavailable');
      showToast({
        message: msg,
        status: 'error',
      });
      setSpeechError(msg);
      return;
    }

    if (isListening === true) {
      SpeechRecognition.stopListening();
    } else {
      SpeechRecognition.startListening({
        language: languageSTT,
        continuous: autoTranscribeAudio,
      });
    }
  }, [
    browserSupportsSpeechRecognition,
    sttExternal,
    isMicrophoneAvailable,
    isListening,
    languageSTT,
    autoTranscribeAudio,
    localize,
    showToast,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyL' && !isBrowserSTTEnabled) {
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBrowserSTTEnabled, toggleListening]);

  useEffect(() => {
    if (!enabled) {
      setSpeechError(undefined);
      clearFinalizeTimeout();
      setIsFinalizing(false);
    }
  }, [enabled, clearFinalizeTimeout]);

  useEffect(() => {
    if (!isBrowserSTTEnabled) {
      return;
    }
    const recognition = SpeechRecognition.getRecognition();
    if (recognition) {
      const handleError = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError(localize('com_ui_microphone_unavailable'));
        } else if (event.error === 'no-speech') {
          // No-speech is transient and not necessarily a blocking error
        } else {
          setSpeechError(`Speech recognition error: ${event.error}`);
        }
        // Whatever the error, no transcript is coming for this recording — don't leave the
        // "converting" state showing until the fallback timeout clears it on its own.
        clearFinalizeTimeout();
        setIsFinalizing(false);
      };
      recognition.addEventListener('error', handleError);
      return () => {
        recognition.removeEventListener('error', handleError);
      };
    }
  }, [isBrowserSTTEnabled, localize, clearFinalizeTimeout]);

  useEffect(() => clearFinalizeTimeout, [clearFinalizeTimeout]);

  return {
    isListening,
    isLoading: isFinalizing,
    startRecording: toggleListening,
    stopRecording: () => {
      SpeechRecognition.stopListening();
      resetTranscript();
      lastTranscript.current = null;
      lastInterim.current = null;
      setSpeechError(undefined);
    },
    error: speechError,
  };
};

export default useSpeechToTextBrowser;
