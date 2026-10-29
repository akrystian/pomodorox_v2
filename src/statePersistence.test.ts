import { describe, expect, it } from 'vitest';
import { loadState, saveState, SCHEMA_VERSION, STORAGE_KEY } from './statePersistence';
import { reduce } from './SessionModel';
import type { SessionState } from './SessionModel';

const memoryStorage = () => {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
	};
};

const task = {
	id: '8c443e19-e4ca-4d94-8215-22a564032f57',
	name: 'Raport kwartalny',
	estimate: 3,
	pomodoroCount: 0,
};

describe('state persistence', () => {
	it('round-trips the domain state, including a running Session, with a schema version', () => {
		const storage = memoryStorage();
		const state: SessionState = {
			tasks: [task],
			activeTaskId: task.id,
			session: {
				kind: 'work',
				taskId: task.id,
				startedAt: 1_761_500_000_000,
				pausedAt: null,
				pausedTotal: 0,
			},
			events: [
				{
					at: 1_761_500_000_000,
					type: 'started',
					kind: 'work',
					taskName: 'Raport kwartalny',
					durationMs: null,
				},
			],
		};

		saveState(state, storage);

		expect(JSON.parse(storage.values.get(STORAGE_KEY)!)).toEqual({
			schemaVersion: SCHEMA_VERSION,
			state,
		});
		expect(loadState(storage)).toEqual(state);
	});

	it('loads Tasks saved by schema version 1 with no Active Task, Session or Events', () => {
		const storage = memoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, state: { tasks: [task] } }));

		expect(loadState(storage)).toEqual({
			tasks: [task],
			activeTaskId: null,
			session: null,
			events: [],
		});
	});

	it('round-trips abandoned Events', () => {
		const storage = memoryStorage();
		const state: SessionState = {
			tasks: [task],
			activeTaskId: task.id,
			session: null,
			events: [
				{ at: 1_761_500_000_000, type: 'started', kind: 'work', taskName: 'Raport kwartalny', durationMs: null },
				{ at: 1_761_500_720_000, type: 'abandoned', kind: 'work', taskName: 'Raport kwartalny', durationMs: 720_000 },
			],
		};

		saveState(state, storage);

		expect(loadState(storage)).toEqual(state);
	});
});

describe('reopen after reload', () => {
	const base = (pausedAt: number | null): SessionState => ({
		tasks: [task],
		activeTaskId: task.id,
		session: { kind: 'work', taskId: task.id, startedAt: 1000, pausedAt, pausedTotal: 0 },
		events: [],
	});

	it('restores a running Session and completes it at scheduledEnd when elapsed', () => {
		const storage = memoryStorage();
		saveState(base(null), storage);

		const result = reduce(loadState(storage), { type: 'REOPEN', at: 1000 + 60 * 60_000 });

		expect(result.state.session).toBeNull();
		expect(result.state.tasks[0]?.pomodoroCount).toBe(1);
		expect(result.state.events.at(-1)?.at).toBe(1000 + 25 * 60_000);
	});

	it('restores a paused Session still paused', () => {
		const storage = memoryStorage();
		saveState(base(1000 + 60_000), storage);

		const result = reduce(loadState(storage), { type: 'REOPEN', at: 1000 + 600 * 60_000 });

		expect(result.state.session?.pausedAt).toBe(1000 + 60_000);
	});
});
