import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { useNetworkState } from 'expo-network';
import { models, useLLM, useOCR } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { extractContact, Msg } from '../lib/extraction';
import { addScan, updateScan } from '../lib/historyStore';
import { availableDiskBytes, llmSources, ocrSources } from '../lib/modelManager';
import { Detection } from '../lib/ocrToText';
import { ContactFields, emptyContactFields } from '../lib/schema';

export type Phase = 'setup' | 'capture' | 'processing' | 'review' | 'success';
export type Stage = 'ocr' | 'llm';
/** Download experience states, mirroring the design: running / failed /
 *  offline / low-storage / ready. */
export type SetupState = 'run' | 'fail' | 'off' | 'sto' | 'rdy';

// Fallback totals when the size probe hasn't answered — measured sizes of the
// resolved sources (craft int8 + crnn english fp32; qwen3 0.6b 8da4w +
// tokenizer files), i.e. the 37 MB / 493 MB the Privacy screen quotes.
const OCR_FALLBACK_BYTES = 39_281_164;
const LLM_FALLBACK_BYTES = 517_118_729;
// Installing needs roughly download + unpack headroom.
const MIN_FREE_BYTES = 200 * 1024 * 1024;

export function useScannerPipeline() {
  // Root-level model hooks — they must never unmount (documented crash if
  // unmounted while generating). The shell is rendered for the app's lifetime.
  const ocr = useOCR({ model: models.ocr.craft({ language: 'en' }) });
  const llm = useLLM({ model: models.llm.qwen3_0_6b() });
  const network = useNetworkState();

  const [phase, setPhase] = useState<Phase>('setup');
  const [stage, setStage] = useState<Stage>('ocr');
  const [fields, setFields] = useState<ContactFields>(emptyContactFields());
  const [rawText, setRawText] = useState('');
  const [degraded, setDegraded] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [readSecs, setReadSecs] = useState<string | null>(null);
  const [llmStartedAt, setLlmStartedAt] = useState<number | null>(null);
  // True only between "generate() called for THIS scan" and the next scan.
  // `llm.response` still holds the previous scan's text until generate()
  // clears it, so the stream must stay gated on this rather than on `stage`.
  const [llmStreaming, setLlmStreaming] = useState(false);
  const [totals, setTotals] = useState({ ocr: OCR_FALLBACK_BYTES, llm: LLM_FALLBACK_BYTES });
  const [scanRecordId, setScanRecordId] = useState<string | null>(null);
  // A capture is waiting for a cancelled scan to finish settling. The capture
  // screen keeps its shutter locked on this — the queue holds one photo, so
  // re-arming would let a second capture silently replace the first.
  const [captureQueued, setCaptureQueued] = useState(false);

  const scanIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingUriRef = useRef<string | null>(null);
  const llmActiveRef = useRef(false);
  const scanT0 = useRef(0);
  const recordRef = useRef<{ id: string; uri: string } | null>(null);
  const speedRef = useRef<{ t: number; bytes: number; mbps: number } | null>(null);

  // ── Setup / download state ────────────────────────────────────────────────
  const modelError = ocr.error ? String(ocr.error) : llm.error ? String(llm.error) : null;
  const ready = ocr.isReady && llm.isReady;
  const online = network.isInternetReachable !== false;

  let setupState: SetupState = 'run';
  if (ready) setupState = 'rdy';
  else if (modelError != null) {
    if (/space|storage|enospc|disk/i.test(modelError) || availableDiskBytes() < MIN_FREE_BYTES) {
      setupState = 'sto';
    } else if (!online) setupState = 'off';
    else setupState = 'fail';
  } else if (!online && ocr.downloadProgress === 0 && llm.downloadProgress === 0) {
    setupState = 'off';
  }

  // Probe the real remote sizes once (falls back to constants offline).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [o, l] = await Promise.all([
          ExpoResourceFetcher.getFilesTotalSize(...ocrSources()),
          ExpoResourceFetcher.getFilesTotalSize(...llmSources()),
        ]);
        if (alive && o > 0 && l > 0) setTotals({ ocr: o, llm: l });
      } catch {
        // offline or HEAD unsupported — keep fallbacks
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Rolling download-throughput estimate for the ETA line.
  const downloadedBytes = totals.ocr * ocr.downloadProgress + totals.llm * llm.downloadProgress;
  useEffect(() => {
    if (phase !== 'setup' || setupState !== 'run') return;
    const now = Date.now();
    const prev = speedRef.current;
    if (prev && now - prev.t >= 900) {
      const inst = ((downloadedBytes - prev.bytes) / (1024 * 1024)) / ((now - prev.t) / 1000);
      const mbps = prev.mbps > 0 ? prev.mbps * 0.7 + Math.max(0, inst) * 0.3 : Math.max(0, inst);
      speedRef.current = { t: now, bytes: downloadedBytes, mbps };
    } else if (!prev) {
      speedRef.current = { t: now, bytes: downloadedBytes, mbps: 0 };
    }
  }, [downloadedBytes, phase, setupState]);

  const mbps = speedRef.current?.mbps ?? 0;
  const remainingBytes = Math.max(0, totals.ocr + totals.llm - downloadedBytes);
  const etaMinutes = mbps > 0.05 ? Math.max(1, Math.round(remainingBytes / (1024 * 1024) / mbps / 60)) : null;

  const beginCapture = useCallback(() => {
    setPhase((p) => (p === 'setup' ? 'capture' : p));
  }, []);

  // ── Scan flow ─────────────────────────────────────────────────────────────
  const scanCard = async (uri: string) => {
    if (inFlightRef.current) {
      // A cancelled scan's native OCR/LLM call is still settling. Queue this
      // capture instead of dropping it — the finally block picks it up.
      pendingUriRef.current = uri;
      setCaptureQueued(true);
      return;
    }
    inFlightRef.current = true;
    const myId = ++scanIdRef.current;
    const isStale = () => scanIdRef.current !== myId;
    setScanError(null);
    setDegraded(false);
    setStage('ocr');
    setDetections([]);
    setImageUri(uri);
    setLlmStartedAt(null);
    setLlmStreaming(false);
    setPhase('processing');
    scanT0.current = Date.now();
    if (recordRef.current?.uri !== uri) recordRef.current = null;
    Image.getSize(
      uri,
      (width, height) => {
        if (!isStale()) setImageSize({ width, height });
      },
      () => {
        if (!isStale()) setImageSize(null);
      }
    );
    try {
      const result = await extractContact(
        {
          ocrForward: async (u) => {
            const dets = await ocr.forward(u);
            if (!isStale()) {
              setDetections(dets as Detection[]);
              setStage('llm');
            }
            return dets;
          },
          llmGenerate: async (messages: Msg[]) => {
            // Ref, not React state: cancel() may fire before `llm.isGenerating`
            // flushes, and interrupt() must still reach the runtime.
            llmActiveRef.current = true;
            if (!isStale()) {
              // Batched with generate()'s own response reset, so the panel
              // never paints the previous scan's tokens.
              setLlmStartedAt(Date.now());
              setLlmStreaming(true);
            }
            try {
              return await llm.generate(messages);
            } finally {
              llmActiveRef.current = false;
            }
          },
          isCancelled: isStale,
        },
        uri
      );
      if (isStale()) return; // cancel() already set the phase
      if (result.status === 'cancelled') {
        return; // cancel() already set the phase
      } else if (result.status === 'no-text') {
        setScanError("Couldn't read that card — try a sharper, closer photo.");
        setPhase('capture');
      } else {
        const nextFields = result.status === 'ok' ? result.fields : emptyContactFields();
        const isDegraded = result.status === 'unparsed';
        setFields(nextFields);
        setRawText(result.rawText);
        setDegraded(isDegraded);
        setReadSecs(`${((Date.now() - scanT0.current) / 1000).toFixed(1)} s`);
        // Record (or refresh, on "run the AI once more") the local history entry.
        try {
          if (recordRef.current?.uri === uri) {
            updateScan(recordRef.current.id, { fields: nextFields, rawText: result.rawText });
          } else {
            const rec = addScan({ fields: nextFields, rawText: result.rawText, sourcePhotoUri: uri });
            recordRef.current = { id: rec.id, uri };
          }
          setScanRecordId(recordRef.current.id);
        } catch (e) {
          console.warn('history record failed', e);
        }
        setPhase('review');
      }
    } catch (e) {
      if (isStale()) return;
      setScanError(`Scan failed: ${(e as Error).message}`);
      setPhase('capture');
    } finally {
      inFlightRef.current = false;
      // A capture arrived while the cancelled scan was settling — run it now.
      const pending = pendingUriRef.current;
      pendingUriRef.current = null;
      setCaptureQueued(false);
      if (pending != null && isStale()) void scanCard(pending);
    }
  };

  const cancel = () => {
    scanIdRef.current += 1;
    pendingUriRef.current = null;
    setCaptureQueued(false);
    if (llmActiveRef.current || llm.isGenerating) llm.interrupt(); // in-flight generate() settles after this
    setPhase('capture');
  };

  /** Degraded review: run OCR + LLM again on the same photo. */
  const retryAi = () => {
    if (imageUri) void scanCard(imageUri);
  };

  /** Called after the native contact form was presented. */
  const completeSave = (edited: ContactFields) => {
    setFields(edited);
    if (recordRef.current) {
      try {
        updateScan(recordRef.current.id, { fields: edited, savedToContacts: true });
      } catch (e) {
        console.warn('history update failed', e);
      }
    }
    setPhase('success');
  };

  const reset = () => {
    setFields(emptyContactFields());
    setRawText('');
    setDegraded(false);
    setScanError(null);
    setImageUri(null);
    setImageSize(null);
    setDetections([]);
    setReadSecs(null);
    setScanRecordId(null);
    recordRef.current = null;
    setPhase('capture');
  };

  return {
    phase,
    stage,
    setupState,
    ocrProgress: ocr.downloadProgress,
    llmProgress: llm.downloadProgress,
    ocrTotalBytes: totals.ocr,
    llmTotalBytes: totals.llm,
    downloadMbps: mbps,
    etaMinutes,
    modelError,
    online,
    streamText: llmStreaming ? llm.response : '',
    llmStartedAt,
    getGeneratedTokenCount: llm.getGeneratedTokenCount,
    fields,
    rawText,
    degraded,
    scanError,
    imageUri,
    imageSize,
    detections,
    readSecs,
    scanRecordId,
    captureQueued,
    beginCapture,
    scanCard,
    cancel,
    retryAi,
    completeSave,
    dismissScanError: () => setScanError(null),
    rescan: () => setPhase('capture'),
    reset,
  };
}
