#!/usr/bin/env node
/**
 * Verifies a test APK before it is published, so that it always installs OVER
 * the app already on a phone (keeping its boards and scores, no uninstall):
 * Android only allows that when the signing certificate is the same as before.
 *
 * Usage: node scripts/verify-apk.mjs <file.apk>
 * Compares the SHA-256 of the APK's signing certificate (v2/v3 APK Signature
 * Scheme block) with credentials/test-signing-cert.sha256.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V2 = 0x7109871a;
const V3 = 0xf05368c0;

/** SHA-256 (hex) of the first signer's certificate, per signature scheme found. */
export function signingCertificates(apk) {
  const eocd = apk.lastIndexOf(Buffer.from('PK\x05\x06', 'latin1'));
  if (eocd < 0) throw new Error('Not a zip/APK file');
  const centralDirectory = apk.readUInt32LE(eocd + 16);
  const magic = apk.subarray(centralDirectory - 16, centralDirectory).toString('latin1');
  if (magic !== 'APK Sig Block 42') throw new Error('The APK has no v2/v3 signature block');
  const size = Number(apk.readBigUInt64LE(centralDirectory - 24));
  const block = apk.subarray(centralDirectory - size + 8 - 8, centralDirectory - 24);
  const prefixed = (buf, at) => {
    const n = buf.readUInt32LE(at);
    return [buf.subarray(at + 4, at + 4 + n), at + 4 + n];
  };
  const found = {};
  for (let pos = 0; pos < block.length;) {
    const length = Number(block.readBigUInt64LE(pos));
    const id = block.readUInt32LE(pos + 8);
    const value = block.subarray(pos + 12, pos + 8 + length);
    pos += 8 + length;
    if (id !== V2 && id !== V3) continue;
    const [signers] = prefixed(value, 0);
    const [signer] = prefixed(signers, 0);
    const [signedData] = prefixed(signer, 0);
    const [, afterDigests] = prefixed(signedData, 0);
    const [certificates] = prefixed(signedData, afterDigests);
    const [certificate] = prefixed(certificates, 0);
    found[id === V2 ? 'v2' : 'v3'] = createHash('sha256').update(certificate).digest('hex');
  }
  return found;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/verify-apk.mjs <file.apk>');
    process.exit(2);
  }
  const expected = readFileSync(join(ROOT, 'credentials/test-signing-cert.sha256'), 'utf8').trim();
  const found = signingCertificates(readFileSync(file));
  const all = Object.values(found);
  if (all.length === 0 || all.some((hash) => hash !== expected)) {
    console.error(
      `verify-apk: ${file} is NOT signed with the test certificate (${JSON.stringify(found)}, expected ${expected}).\n` +
        'Phones could not install it over the current app without uninstalling it (losing boards and scores).',
    );
    process.exit(1);
  }
  console.log(
    `verify-apk: signed with the test certificate (${expected}) — installs over the current app.`,
  );
}
