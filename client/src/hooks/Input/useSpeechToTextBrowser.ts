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
  }, [enabled, setText, onTranscriptionComplete, resetTranscript, finalTranscript, autoSendText]);

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
    }
  }, [enabled]);

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
      };
      recognition.addEventListener('error', handleError);
      return () => {
        recognition.removeEventListener('error', handleError);
      };
    }
  }, [isBrowserSTTEnabled, localize]);

  return {
    isListening,
    isLoading: false,
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
