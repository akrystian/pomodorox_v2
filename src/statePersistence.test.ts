import { describe, expect, it } from 'vitest';
import { loadState, saveState, SCHEMA_VERSION, STORAGE_KEY } from './statePersistence';
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
			soundEnabled: false,
			notificationsEnabled: true,
			notificationPermission: 'granted',
			permissionPrompted: true,
		};

		saveState(state, storage);

		expect(JSON.parse(storage.values.get(STORAGE_KEY)!)).toEqual({
			schemaVersion: 3,
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
			soundEnabled: true,
			notificationsEnabled: true,
			notificationPermission: 'default',
			permissionPrompted: false,
		});
	});

	it('adds default preferences when loading schema version 2', () => {
		const storage = memoryStorage();
		const state = {
			tasks: [task],
			activeTaskId: task.id,
			session: null,
			events: [],
		};
		storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, state }));

		expect(loadState(storage)).toEqual({
			...state,
			soundEnabled: true,
			notificationsEnabled: true,
			notificationPermission: 'default',
			permissionPrompted: false,
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
			soundEnabled: true,
			notificationsEnabled: false,
			notificationPermission: 'denied',
			permissionPrompted: true,
		};

		saveState(state, storage);

		expect(loadState(storage)).toEqual(state);
	});
});
