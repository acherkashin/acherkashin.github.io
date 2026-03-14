import assert from 'node:assert/strict';
import test from 'node:test';

import { isNewYear, resolveSeason } from '../src/utils/newYearUtils.ts';

test('returns false for dates outside the new year season', () => {
	assert.equal(isNewYear(new Date('2026-03-14T12:00:00.000Z')), false);
	assert.equal(isNewYear(new Date('2027-01-11T12:00:00.000Z')), false);
});

test('returns true for dates inside the new year season', () => {
	assert.equal(isNewYear(new Date('2026-12-25T12:00:00.000Z')), true);
	assert.equal(isNewYear(new Date('2027-01-05T12:00:00.000Z')), true);
});

test('resolves no season outside the new year season by default', () => {
	assert.equal(resolveSeason(new Date('2026-03-14T12:00:00.000Z')), null);
	assert.equal(resolveSeason(new Date('2027-01-11T12:00:00.000Z')), null);
});

test('resolves new year season from date when inside the seasonal window', () => {
	assert.equal(resolveSeason(new Date('2026-12-25T12:00:00.000Z')), 'new-year');
	assert.equal(resolveSeason(new Date('2027-01-05T12:00:00.000Z')), 'new-year');
});

test('forces new year season from the season query parameter', () => {
	assert.equal(resolveSeason(new Date('2026-03-14T12:00:00.000Z'), '?season=new-year'), 'new-year');
});

test('ignores unknown season query parameter values', () => {
	assert.equal(resolveSeason(new Date('2026-03-14T12:00:00.000Z'), '?season=unknown'), null);
});
