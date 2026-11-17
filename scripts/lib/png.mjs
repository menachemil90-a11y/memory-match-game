/**
 * Encodes a rendered resvg image as a 24-bit RGB PNG (no alpha channel).
 * Google Play requires "JPEG or 24-bit PNG (no alpha)" for the feature graphic
 * and screenshots. Render with an opaque `background` first: alpha is dropped.
 */
import { Buffer } from 'node:buffer';
import { crc32, deflateSync } from 'node:zlib';

/** @param {{ width: number, height: number, pixels: Uint8Array }} image RGBA pixels */
export function encodeRgbPng({ width: w, height: h, pixels }) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3); // filter byte 0 (None), then RGB triples
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[row + 1 + x * 3] = pixels[i];
      raw[row + 2 + x * 3] = pixels[i + 1];
      raw[row + 3 + x * 3] = pixels[i + 2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB, no alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
