// Structurally compatible with react-native-executorch's OCRDetection —
// defined locally so lib/ stays free of React Native imports (testability).
export interface Detection {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  text: string;
  score: number;
}

const centerY = (det: Detection) => (det.bbox.y1 + det.bbox.y2) / 2;
const height = (det: Detection) => Math.abs(det.bbox.y2 - det.bbox.y1);

export function ocrToText(
  detections: Detection[],
  opts: { minScore?: number; maxChars?: number } = {}
): string {
  const { minScore = 0.3, maxChars = 1500 } = opts;

  const kept = detections.filter((det) => det.score >= minScore);
  const sorted = [...kept].sort((a, b) => centerY(a) - centerY(b));

  // Band into lines: a detection joins the current line if its y-center is
  // within half a box height of the line's first box. Defensive re-sort within
  // each line: the library once returned scrambled within-line order (#1159).
  const lines: Detection[][] = [];
  for (const det of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(centerY(det) - centerY(current[0])) <= height(current[0]) / 2) {
      current.push(det);
    } else {
      lines.push([det]);
    }
  }

  const text = lines
    .map((line) => [...line].sort((a, b) => a.bbox.x1 - b.bbox.x1).map((det) => det.text).join(' '))
    .join('\n');

  return text.slice(0, maxChars);
}
