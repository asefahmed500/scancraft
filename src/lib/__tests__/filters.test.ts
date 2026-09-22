import { FILTER_PRESETS, composeMatrix, getFilterPreset, matrixFor, NEUTRAL_ADJUSTMENTS } from '../filters';

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

function applyRow(matrix: number[], r: number, g: number, b: number): [number, number, number] {
  return [
    matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[4],
    matrix[5] * r + matrix[6] * g + matrix[7] * b + matrix[9],
    matrix[10] * r + matrix[11] * g + matrix[12] * b + matrix[14],
  ];
}

describe('filters — color matrix math', () => {
  test('every preset produces a valid 4x5 matrix with unit alpha', () => {
    for (const preset of FILTER_PRESETS) {
      expect(preset.base).toHaveLength(20);
      preset.base.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      expect(preset.base.slice(15, 19)).toEqual([0, 0, 0, 1]);
    }
  });

  test('original preset with neutral adjustments is the identity', () => {
    expect(matrixFor('original', NEUTRAL_ADJUSTMENTS)).toEqual(IDENTITY);
  });

  test('identity composed with anything is that thing (offset math)', () => {
    const gray = getFilterPreset('grayscale').base;
    expect(composeMatrix(IDENTITY, NEUTRAL_ADJUSTMENTS)).toEqual(IDENTITY);
    // multiply(identity, gray) === gray
    const viaCompose = matrixFor('grayscale', NEUTRAL_ADJUSTMENTS);
    expect(viaCompose).toEqual(gray);
  });

  test('grayscale rows match luminance coefficients', () => {
    const m = matrixFor('grayscale', NEUTRAL_ADJUSTMENTS);
    expect(m[0]).toBeCloseTo(0.213, 5);
    expect(m[1]).toBeCloseTo(0.715, 5);
    expect(m[2]).toBeCloseTo(0.072, 5);
    expect(m[6]).toBeCloseTo(0.715, 5);
    expect(m[12]).toBeCloseTo(0.072, 5);
  });

  test('mid-gray stays mid-gray under contrast boost', () => {
    const m = matrixFor('original', { brightness: 1, contrast: 1.35, saturation: 1 });
    const [r, g, b] = applyRow(m, 128, 128, 128);
    expect(r).toBeCloseTo(128, 5);
    expect(g).toBeCloseTo(128, 5);
    expect(b).toBeCloseTo(128, 5);
  });

  test('saturation zero equals grayscale regardless of preset base', () => {
    const m = matrixFor('vivid', { brightness: 1, contrast: 1, saturation: 0 });
    const gray = matrixFor('grayscale', NEUTRAL_ADJUSTMENTS);
    // sat(a)·sat(b) = sat(ab) mathematically; float epsilon differs, so
    // compare per-element with tolerance.
    m.forEach((v, i) => expect(v).toBeCloseTo(gray[i], 6));
  });

  test('brightness scales channels multiplicatively', () => {
    const m = matrixFor('original', { brightness: 1.2, contrast: 1, saturation: 1 });
    const [r] = applyRow(m, 100, 100, 100);
    expect(r).toBeCloseTo(120, 5);
  });

  test('B&W preset is grayscale followed by a contrast boost', () => {
    const bw = matrixFor('bw', NEUTRAL_ADJUSTMENTS);
    const gray = getFilterPreset('grayscale').base;
    expect(bw[0]).toBeCloseTo(0.213 * 1.35, 5);
    expect(bw[1]).toBeCloseTo(0.715 * 1.35, 5);
    expect(bw[4]).toBeCloseTo(128 * (1 - 1.35), 5);
    // spot-check an actual pixel: mid-gray maps to mid-gray
    const [r] = applyRow(bw, 128, 128, 128);
    expect(r).toBeCloseTo(128, 5);
    expect(gray).toBeDefined();
  });

  test('magic preset keeps pixels sane for black and white inputs', () => {
    const m = matrixFor('magic', NEUTRAL_ADJUSTMENTS);
    // Skia clamps final colors to [0,255]; the unclamped matrix may push
    // black slightly negative (contrast offset) — both are finite and the
    // renderer handles the clamping.
    for (const [r, g, b] of [
      [0, 0, 0],
      [255, 255, 255],
      [128, 128, 128],
    ] as const) {
      const [or_, og, ob] = applyRow(m, r, g, b);
      expect(Number.isFinite(or_)).toBe(true);
      expect(Number.isFinite(og)).toBe(true);
      expect(Number.isFinite(ob)).toBe(true);
      expect(or_).toBeGreaterThanOrEqual(-24);
      expect(or_).toBeLessThanOrEqual(290);
    }
  });

  test('getFilterPreset falls back to original for unknown ids', () => {
    expect(getFilterPreset('nope' as never).id).toBe('original');
  });
});
