import { colors, minTouchTarget, typography } from '../tokens';

const HEX = /^#[0-9A-F]{6}$/i;

/** WCAG relative luminance contrast ratio between two #RRGGBB colors. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r = 0, g = 0, bl = 0] = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('design tokens', () => {
  it('uses valid hex colors for every button variant', () => {
    for (const scheme of Object.values(colors.button)) {
      expect(scheme.face).toMatch(HEX);
      expect(scheme.edge).toMatch(HEX);
      expect(scheme.text).toMatch(HEX);
    }
  });

  it('gives large button labels at least 3:1 contrast (WCAG large text)', () => {
    for (const [name, scheme] of Object.entries(colors.button)) {
      expect({ name, ratio: contrast(scheme.face, scheme.text) >= 3 }).toEqual({
        name,
        ratio: true,
      });
    }
  });

  it('keeps tap targets at least 48dp', () => {
    expect(minTouchTarget).toBeGreaterThanOrEqual(48);
  });

  it('defines a font family for every typography variant', () => {
    for (const style of Object.values(typography)) {
      expect(style.fontFamily).toMatch(/^Fredoka_/);
    }
  });
});
