import type { Adjustments, FilterId } from './types';

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
};

// 4x5 color matrix, row-major: [rR rG rB rA rO, gR ... , bR ..., aR ...]
type Matrix = number[];

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let value = col === 4 ? a[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) {
        value += a[row * 5 + k] * b[k * 5 + col];
      }
      out[row * 5 + col] = value;
    }
  }
  return out;
}

function brightnessMatrix(f: number): Matrix {
  return [f, 0, 0, 0, 0, 0, f, 0, 0, 0, 0, 0, f, 0, 0, 0, 0, 0, 1, 0];
}

function contrastMatrix(c: number): Matrix {
  const o = 128 * (1 - c);
  return [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
}

function saturationMatrix(s: number): Matrix {
  const lr = 0.213;
  const lg = 0.715;
  const lb = 0.072;
  return [
    lr + (1 - lr) * s, lg - lg * s, lb - lb * s, 0, 0,
    lr - lr * s, lg + (1 - lg) * s, lb - lb * s, 0, 0,
    lr - lr * s, lg - lg * s, lb + (1 - lb) * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function desaturateMatrix(): Matrix {
  return saturationMatrix(0);
}

export type FilterPreset = {
  id: FilterId;
  label: string;
  base: Matrix;
};

// Tuned for document scanning: paper should land near white, ink near
// black. B&W uses a strong contrast anchor (2.1) so faint pencil (90-110)
// separates clearly from paper (200+) — Skia clamps the output range.
export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', base: IDENTITY },
  {
    id: 'auto',
    label: 'Auto',
    base: multiply(multiply(saturationMatrix(1.18), contrastMatrix(1.3)), brightnessMatrix(1.05)),
  },
  { id: 'grayscale', label: 'Grayscale', base: desaturateMatrix() },
  {
    id: 'bw',
    label: 'B&W',
    base: multiply(desaturateMatrix(), multiply(contrastMatrix(2.1), brightnessMatrix(1.02))),
  },
  { id: 'vivid', label: 'Color', base: saturationMatrix(1.35) },
  {
    id: 'magic',
    label: 'Magic Color',
    base: multiply(multiply(saturationMatrix(1.22), contrastMatrix(1.35)), brightnessMatrix(1.06)),
  },
  {
    id: 'highcontrast',
    label: 'High contrast',
    base: multiply(saturationMatrix(0.9), contrastMatrix(1.75)),
  },
  {
    id: 'lowlight',
    label: 'Low light',
    base: multiply(multiply(saturationMatrix(1.05), contrastMatrix(1.1)), brightnessMatrix(1.3)),
  },
];

export function getFilterPreset(id: FilterId): FilterPreset {
  return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0];
}

export function composeMatrix(base: Matrix, adj: Adjustments): Matrix {
  const b = brightnessMatrix(adj.brightness);
  const c = contrastMatrix(adj.contrast);
  const s = saturationMatrix(adj.saturation);
  return multiply(b, multiply(c, multiply(s, base)));
}

export function matrixFor(id: FilterId, adj: Adjustments): Matrix {
  return composeMatrix(getFilterPreset(id).base, adj);
}
