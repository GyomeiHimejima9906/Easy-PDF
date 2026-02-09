
import { useState, useEffect, useCallback, useRef } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synth = useRef<SpeechSynthesis>(window.speechSynthesis);

  useEffect(() => {
    const updateVoices = () => {
      setVoices(synth.current.getVoices());
    };

    updateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      synth.current.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    if (synth.current.speaking) {
      synth.current.cancel();
    }

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to match voice to language
    const voice = voices.find(v => v.lang.startsWith(lang)) || voices.find(v => v.default);
    if (voice) utterance.voice = voice;
    
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.current.speak(utterance);
  }, [voices]);

  const stop = useCallback(() => {
    synth.current.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, voices };
};
