import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { buildDiffPanes, calculateDiffStats, toDisplayLines } from './TextDiff.model';
import type { LocaleText } from './TextDiff.types';

export function useTextDiffController({ mt }: { mt: LocaleText }) {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [leftName, setLeftName] = useState('');
  const [rightName, setRightName] = useState('');
  const leftFileRef = useRef<HTMLInputElement>(null);
  const rightFileRef = useRef<HTMLInputElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const hasDiff = left.length > 0 && right.length > 0;
  const { leftLines, rightLines } = useMemo(() => {
    if (hasDiff) return buildDiffPanes(left, right);
    return {
      leftLines: left ? toDisplayLines(left) : [],
      rightLines: right ? toDisplayLines(right) : [],
    };
  }, [hasDiff, left, right]);
  const stats = useMemo(() => calculateDiffStats(leftLines, rightLines), [leftLines, rightLines]);

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === 'left' ? leftPaneRef.current : rightPaneRef.current;
    const to = source === 'left' ? rightPaneRef.current : leftPaneRef.current;
    if (from && to) to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  useEffect(() => {
    const leftElement = leftPaneRef.current;
    const rightElement = rightPaneRef.current;
    if (!leftElement || !rightElement) return;
    const onLeftScroll = () => syncScroll('left');
    const onRightScroll = () => syncScroll('right');
    leftElement.addEventListener('scroll', onLeftScroll, { passive: true });
    rightElement.addEventListener('scroll', onRightScroll, { passive: true });
    return () => {
      leftElement.removeEventListener('scroll', onLeftScroll);
      rightElement.removeEventListener('scroll', onRightScroll);
    };
  }, [syncScroll]);

  const loadFile = useCallback(
    (setter: (value: string) => void, nameSetter: (value: string) => void) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        nameSetter(file.name);
        const reader = new FileReader();
        reader.onload = () => setter(reader.result as string);
        reader.readAsText(file);
        event.target.value = '';
      },
    [],
  );

  const clearLeft = useCallback(() => {
    setLeft('');
    setLeftName('');
  }, []);

  const clearRight = useCallback(() => {
    setRight('');
    setRightName('');
  }, []);

  return {
    leftTitle: leftName || mt('originalFile'),
    rightTitle: rightName || mt('modifiedFile'),
    leftFileRef,
    rightFileRef,
    leftPaneRef,
    rightPaneRef,
    leftLines,
    rightLines,
    stats,
    onLeftFileSelect: loadFile(setLeft, setLeftName),
    onRightFileSelect: loadFile(setRight, setRightName),
    onClearLeft: clearLeft,
    onClearRight: clearRight,
  };
}
