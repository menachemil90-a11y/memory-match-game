/** @jest-environment node */
/* global describe, it, expect */
const { applyBuildProperties, PROPERTIES } = require('../withAndroidBuildResources');

const prop = (key, value) => ({ type: 'property', key, value });

describe('Android build resources (gradle.properties)', () => {
  it('replaces the template defaults that make 16 GB build machines run out of memory', () => {
    const items = applyBuildProperties([
      { type: 'comment', value: ' JVM settings' },
      prop('org.gradle.jvmargs', '-Xmx2048m -XX:MaxMetaspaceSize=512m'),
      prop('reactNativeArchitectures', 'armeabi-v7a,arm64-v8a,x86,x86_64'),
      prop('newArchEnabled', 'true'),
    ]);
    const get = (k) => items.filter((i) => i.type === 'property' && i.key === k);
    for (const [key, value] of Object.entries(PROPERTIES)) {
      expect(get(key)).toEqual([prop(key, value)]); // set once, no duplicates
    }
    expect(get('newArchEnabled')).toEqual([prop('newArchEnabled', 'true')]);
    expect(items[0]).toEqual({ type: 'comment', value: ' JVM settings' });
  });

  it('uses one JVM of at most 4 GB, few workers, and builds phone ABIs only', () => {
    expect(PROPERTIES['org.gradle.jvmargs']).toMatch(/-Xmx4g\b/);
    expect(PROPERTIES['kotlin.compiler.execution.strategy']).toBe('in-process');
    expect(Number(PROPERTIES['org.gradle.workers.max'])).toBeLessThanOrEqual(3);
    expect(PROPERTIES.reactNativeArchitectures.split(',').sort()).toEqual([
      'arm64-v8a',
      'armeabi-v7a',
    ]);
  });
});
