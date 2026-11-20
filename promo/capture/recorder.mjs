/**
 * Records a page as sharp frames in real time: a tight loop of full-resolution
 * screenshots (CSS 360×640 at device scale 2 = 720×1280), each
 * stamped with the moment it was taken, plus named markers on the same clock.
 * (Chrome's screencast is capped at CSS pixels, i.e. 360×640: too soft.)
 *
 * A clip is a folder: frames/NNNNNN.jpg + clip.json
 *   { frames: [{ t, file }], markers: [{ t, name }] }   — t in seconds.
 * Pages must come from a browser context with deviceScaleFactor SCALE.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Device scale of the footage: 360×640 CSS px → 720×1280 (the phone screen in the videos is ≤ 720 px wide). */
export const SCALE = 2;

export async function startRecording(page, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'frames'), { recursive: true });
  let cdp = await page.context().newCDPSession(page);
  const viewport = page.viewportSize();
  const frames = [];
  const markers = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const before = Date.now();
      let shot;
      try {
        // The clip's scale renders at full device resolution (without it the
        // capture is a 360×640 image scaled up: soft).
        shot = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 90,
          optimizeForSpeed: true,
          clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: SCALE },
        });
      } catch (error) {
        if (!running) break;
        // A navigation to another site swaps the page's process: attach again.
        if (/not attached|detached|session closed|target closed/i.test(String(error))) {
          await new Promise((ok) => setTimeout(ok, 50));
          cdp = await page.context().newCDPSession(page);
          continue;
        }
        throw error;
      }
      const t = (before + Date.now()) / 2000;
      const file = `frames/${String(frames.length).padStart(6, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(shot.data, 'base64'));
      frames.push({ t, file });
    }
  })();
  return {
    /** Marks a moment (e.g. "flip", "match", "cut:deal") on the recording's clock. */
    mark(name) {
      markers.push({ t: Date.now() / 1000, name });
    },
    /** Facts about the recording (e.g. the room code), saved in clip.json. */
    meta: {},
    async stop() {
      running = false;
      await loop;
      await cdp.detach().catch(() => undefined);
      writeFileSync(
        join(dir, 'clip.json'),
        JSON.stringify({ meta: this.meta, frames, markers }, null, 1),
      );
      const seconds = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
      return { frames: frames.length, seconds, fps: frames.length / Math.max(seconds, 0.001) };
    },
  };
}
