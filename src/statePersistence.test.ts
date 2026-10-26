import { describe, expect, it } from 'vitest';
import { loadState, saveState, SCHEMA_VERSION, STORAGE_KEY } from './statePersistence';
import type { SessionState } from './SessionModel';

describe('state persistence', () => {
	it('round-trips the domain state with a schema version', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const state: SessionState = {
			tasks: [
				{
					id: '8c443e19-e4ca-4d94-8215-22a564032f57',
					name: 'Raport kwartalny',
					estimate: 3,
					pomodoroCount: 0,
				},
			],
		};

		saveState(state, storage);

		expect(JSON.parse(values.get(STORAGE_KEY)!)).toEqual({
			schemaVersion: SCHEMA_VERSION,
			state,
		});
		expect(loadState(storage)).toEqual(state);
	});
});
