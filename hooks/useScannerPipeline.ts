import { useEffect, useRef, useState } from 'react';
import { models, useLLM, useOCR } from 'react-native-executorch';
import { extractContact, Msg } from '../lib/extraction';
import { ContactFields, emptyContactFields } from '../lib/schema';

export type Phase = 'loading-models' | 'capture' | 'processing' | 'review' | 'done';
export type Stage = 'ocr' | 'llm';

export function useScannerPipeline() {
  // Root-level model hooks — they must never unmount (documented crash if
  // unmounted while generating). Scanner is rendered for the app's lifetime.
  const ocr = useOCR({ model: models.ocr.craft({ language: 'en' }) });
  const llm = useLLM({ model: models.llm.qwen3_0_6b() });

  const [phase, setPhase] = useState<Phase>('loading-models');
  const [stage, setStage] = useState<Stage>('ocr');
  const [fields, setFields] = useState<ContactFields>(emptyContactFields());
  const [rawText, setRawText] = useState('');
  const [degraded, setDegraded] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanIdRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (phase === 'loading-models' && ocr.isReady && llm.isReady) {
      setPhase('capture');
    }
  }, [phase, ocr.isReady, llm.isReady]);

  const scanCard = async (imageUri: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const myId = ++scanIdRef.current;
    const isStale = () => scanIdRef.current !== myId;
    setScanError(null);
    setDegraded(false);
    setStage('ocr');
    setPhase('processing');
    try {
      const result = await extractContact(
        {
          ocrForward: async (uri) => {
            const detections = await ocr.forward(uri);
            if (!isStale()) setStage('llm');
            return detections;
          },
          llmGenerate: (messages: Msg[]) => llm.generate(messages),
          isCancelled: isStale,
        },
        imageUri
      );
      if (isStale()) return; // cancel() already set the phase
      if (result.status === 'cancelled') {
        return; // cancel() already set the phase
      } else if (result.status === 'no-text') {
        setScanError("Couldn't read the card. Try a sharper, closer photo.");
        setPhase('capture');
      } else {
        setFields(result.status === 'ok' ? result.fields : emptyContactFields());
        setRawText(result.rawText);
        setDegraded(result.status === 'unparsed');
        setPhase('review');
      }
    } catch (e) {
      if (isStale()) return;
      setScanError(`Scan failed: ${(e as Error).message}`);
      setPhase('capture');
    } finally {
      inFlightRef.current = false;
    }
  };

  const cancel = () => {
    scanIdRef.current += 1;
    if (llm.isGenerating) llm.interrupt(); // in-flight generate() settles after this
    setPhase('capture');
  };

  return {
    phase,
    stage,
    ocrProgress: ocr.downloadProgress,
    llmProgress: llm.downloadProgress,
    modelError: ocr.error ? String(ocr.error) : llm.error ? String(llm.error) : null,
    streamText: llm.response,
    fields,
    rawText,
    degraded,
    scanError,
    scanCard,
    cancel,
    rescan: () => setPhase('capture'),
    finishSave: () => setPhase('done'),
    reset: () => {
      setFields(emptyContactFields());
      setRawText('');
      setDegraded(false);
      setScanError(null);
      setPhase('capture');
    },
  };
}
