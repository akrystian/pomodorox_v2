import { describe, expect, it } from 'vitest';
import { strings } from './strings';

const leaves = (node: unknown): string[] =>
	typeof node === 'string' ? [node] : Object.values(node as object).flatMap(leaves);

describe('strings', () => {
	it('has no empty user-facing text', () => {
		expect(leaves(strings).filter((s) => s.trim() === '')).toEqual([]);
	});
});
