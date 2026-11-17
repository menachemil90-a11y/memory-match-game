/** @jest-environment node */
import { formatDuration } from '../format';

it('formats durations as m:ss', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(9999)).toBe('0:09');
  expect(formatDuration(75000)).toBe('1:15');
  expect(formatDuration(3600000)).toBe('60:00');
  expect(formatDuration(-5)).toBe('0:00');
});
