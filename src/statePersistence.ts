import { initialState } from './SessionModel';
import type { SessionState, Task } from './SessionModel';

export const STORAGE_KEY = 'pomodorox.session';
export const SCHEMA_VERSION = 1;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;

function isTask(value: unknown): value is Task {
	if (typeof value !== 'object' || value === null) return false;
	const task = value as Record<string, unknown>;
	return (
		typeof task.id === 'string' &&
		typeof task.name === 'string' &&
		task.name.trim().length > 0 &&
		typeof task.estimate === 'number' &&
		Number.isInteger(task.estimate) &&
		task.estimate >= 1 &&
		typeof task.pomodoroCount === 'number' &&
		Number.isInteger(task.pomodoroCount) &&
		task.pomodoroCount >= 0
	);
}

function isSessionState(value: unknown): value is SessionState {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray((value as { tasks?: unknown }).tasks) &&
		(value as { tasks: unknown[] }).tasks.every(isTask)
	);
}

export function saveState(state: SessionState, storage: StorageAdapter = localStorage): void {
	storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }));
}

export function loadState(storage: StorageAdapter = localStorage): SessionState {
	const serialized = storage.getItem(STORAGE_KEY);
	if (!serialized) return initialState();

	try {
		const value: unknown = JSON.parse(serialized);
		if (
			typeof value === 'object' &&
			value !== null &&
			(value as { schemaVersion?: unknown }).schemaVersion === SCHEMA_VERSION &&
			isSessionState((value as { state?: unknown }).state)
		) {
			return (value as { state: SessionState }).state;
		}
	} catch {
		return initialState();
	}

	return initialState();
}
