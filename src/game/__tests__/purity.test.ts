/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GAME_DIR = join(__dirname, '..');

describe('engine purity', () => {
  const sources = readdirSync(GAME_DIR).filter((f) => /\.tsx?$/.test(f));

  it.each(sources)('%s imports nothing outside the engine', (file) => {
    const code = readFileSync(join(GAME_DIR, file), 'utf8');
    const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec).toMatch(/^\.\//);
    expect(code).not.toMatch(/Math\.random/);
  });
});
