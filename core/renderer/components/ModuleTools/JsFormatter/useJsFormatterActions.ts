import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beautifyJavascript,
  evalPackJavascript,
  highCompressJavascript,
  isAbortError,
  minifyJavascript,
  obfuscateInWorker,
} from './JsFormatter.operations';

export function useJsFormatterActions(input: string, onClearInput: () => void) {
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [copied, setCopied] = useState(false);
  const operationIdRef = useRef(0);
  const operationAbortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const cancelCurrentOperation = useCallback(() => {
    operationIdRef.current += 1;
    operationAbortRef.current?.abort();
    operationAbortRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelCurrentOperation();
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [cancelCurrentOperation],
  );

  const runAsync = useCallback(
    async (fn: (signal: AbortSignal) => Promise<string>, highlighted = false) => {
      if (!input.trim()) return;
      const operationId = operationIdRef.current + 1;
      cancelCurrentOperation();
      operationIdRef.current = operationId;
      const controller = new AbortController();
      operationAbortRef.current = controller;
      setProcessing(true);
      setError('');
      setHighlight(highlighted);
      try {
        const result = await fn(controller.signal);
        if (operationIdRef.current !== operationId || controller.signal.aborted) return;
        setOutput(result);
      } catch (e) {
        if (operationIdRef.current !== operationId || isAbortError(e)) return;
        setError((e as Error).message);
        setOutput('');
      } finally {
        if (operationIdRef.current === operationId) {
          operationAbortRef.current = null;
          setProcessing(false);
        }
      }
    },
    [cancelCurrentOperation, input],
  );

  const handleBeautify = useCallback(() => {
    void runAsync(() => beautifyJavascript(input), true);
  }, [input, runAsync]);

  const handleMinify = useCallback(() => {
    void runAsync(() => minifyJavascript(input));
  }, [input, runAsync]);

  const handleObfuscate = useCallback(() => {
    void runAsync((signal) => obfuscateInWorker(input, signal));
  }, [input, runAsync]);

  const handleEvalPack = useCallback(() => {
    void runAsync(() => evalPackJavascript(input));
  }, [input, runAsync]);

  const handleHighCompress = useCallback(() => {
    void runAsync(() => highCompressJavascript(input));
  }, [input, runAsync]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 1500);
  }, [output]);

  const handleClear = useCallback(() => {
    cancelCurrentOperation();
    onClearInput();
    setOutput('');
    setError('');
    setHighlight(false);
    setProcessing(false);
  }, [cancelCurrentOperation, onClearInput]);

  return {
    output,
    error,
    processing,
    highlight,
    copied,
    handleBeautify,
    handleMinify,
    handleObfuscate,
    handleEvalPack,
    handleHighCompress,
    handleCopy,
    handleClear,
  };
}
