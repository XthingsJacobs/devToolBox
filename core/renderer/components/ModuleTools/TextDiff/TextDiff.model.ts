import * as Diff from 'diff';
import type { DiffLine, DiffPanes, DiffSide, DiffStats, WordPart } from './TextDiff.types';

export function buildWordParts(
  oldText: string,
  newText: string,
  side: Extract<DiffSide, 'left' | 'right'>,
): WordPart[] {
  return Diff.diffWords(oldText, newText).flatMap((part): WordPart[] => {
    if (side === 'left' && part.removed) return [{ value: part.value, type: 'removed' }];
    if (side === 'right' && part.added) return [{ value: part.value, type: 'added' }];
    if (!part.added && !part.removed) return [{ value: part.value, type: 'equal' }];
    return [];
  });
}

export function toDisplayLines(text: string): DiffLine[] {
  return text.split('\n').map((line, index) => ({ num: index + 1, content: line, type: 'equal' as const }));
}

function splitDiffLines(value: string): string[] {
  return value.replace(/\n$/, '').split('\n');
}

export function buildDiffPanes(left: string, right: string): DiffPanes {
  const changes = Diff.diffLines(left, right);
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];
  let leftNum = 1;
  let rightNum = 1;

  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i];
    const lines = splitDiffLines(change.value);

    if (!change.added && !change.removed) {
      for (const line of lines) {
        leftLines.push({ num: leftNum, content: line, type: 'equal' });
        rightLines.push({ num: rightNum, content: line, type: 'equal' });
        leftNum += 1;
        rightNum += 1;
      }
    } else if (change.removed) {
      const next = changes[i + 1];
      if (next?.added) {
        const addedLines = splitDiffLines(next.value);
        const maxLen = Math.max(lines.length, addedLines.length);
        for (let j = 0; j < maxLen; j += 1) {
          const oldLine = j < lines.length ? lines[j] : undefined;
          const newLine = j < addedLines.length ? addedLines[j] : undefined;
          if (oldLine !== undefined && newLine !== undefined) {
            leftLines.push({
              num: leftNum + j,
              content: buildWordParts(oldLine, newLine, 'left'),
              type: 'modified',
            });
            rightLines.push({
              num: rightNum + j,
              content: buildWordParts(oldLine, newLine, 'right'),
              type: 'modified',
            });
          } else if (oldLine !== undefined) {
            leftLines.push({ num: leftNum + j, content: oldLine, type: 'removed' });
            rightLines.push({ type: 'empty', content: '' });
          } else if (newLine !== undefined) {
            leftLines.push({ type: 'empty', content: '' });
            rightLines.push({ num: rightNum + j, content: newLine, type: 'added' });
          }
        }
        leftNum += lines.length;
        rightNum += addedLines.length;
        i += 1;
      } else {
        for (let j = 0; j < lines.length; j += 1) {
          leftLines.push({ num: leftNum + j, content: lines[j], type: 'removed' });
          rightLines.push({ type: 'empty', content: '' });
        }
        leftNum += lines.length;
      }
    } else if (change.added) {
      for (let j = 0; j < lines.length; j += 1) {
        leftLines.push({ type: 'empty', content: '' });
        rightLines.push({ num: rightNum + j, content: lines[j], type: 'added' });
      }
      rightNum += lines.length;
    }
  }

  return { leftLines, rightLines };
}

export function calculateDiffStats(leftLines: DiffLine[], rightLines: DiffLine[]): DiffStats {
  const removed = leftLines.filter((line) => line.type === 'removed' || line.type === 'modified').length;
  const added = rightLines.filter((line) => line.type === 'added' || line.type === 'modified').length;
  return { added, removed };
}
