import { EVENT_TYPES, SESSION_KINDS, initialState } from './SessionModel';
import type { Session, SessionEvent, SessionState, Task } from './SessionModel';

export const STORAGE_KEY = 'pomodorox.session';
export const SCHEMA_VERSION = 2;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isKind = (value: unknown) => SESSION_KINDS.some((kind) => kind === value);

const isNullableString = (value: unknown) => value === null || typeof value === 'string';

const isNullableNumber = (value: unknown) => value === null || typeof value === 'number';

function isTask(value: unknown): value is Task {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		value.name.trim().length > 0 &&
		typeof value.estimate === 'number' &&
		Number.isInteger(value.estimate) &&
		value.estimate >= 1 &&
		typeof value.pomodoroCount === 'number' &&
		Number.isInteger(value.pomodoroCount) &&
		value.pomodoroCount >= 0
	);
}

function isSession(value: unknown): value is Session {
	return (
		isRecord(value) &&
		isKind(value.kind) &&
		isNullableString(value.taskId) &&
		typeof value.startedAt === 'number' &&
		isNullableNumber(value.pausedAt) &&
		typeof value.pausedTotal === 'number'
	);
}

function isEvent(value: unknown): value is SessionEvent {
	return (
		isRecord(value) &&
		typeof value.at === 'number' &&
		EVENT_TYPES.some((type) => type === value.type) &&
		isKind(value.kind) &&
		isNullableString(value.taskName) &&
		isNullableNumber(value.durationMs)
	);
}

function isSessionState(value: unknown): value is SessionState {
	return (
		isRecord(value) &&
		Array.isArray(value.tasks) &&
		value.tasks.every(isTask) &&
		isNullableString(value.activeTaskId) &&
		(value.session === null || isSession(value.session)) &&
		Array.isArray(value.events) &&
		value.events.every(isEvent)
	);
}

// Version 1 stored only Tasks.
function migrate(schemaVersion: unknown, state: unknown): unknown {
	if (schemaVersion === 1 && isRecord(state)) return { ...initialState(), tasks: state.tasks };
	if (schemaVersion === SCHEMA_VERSION) return state;
	return null;
}

export function saveState(state: SessionState, storage: StorageAdapter = localStorage): void {
	storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }));
}

export function loadState(storage: StorageAdapter = localStorage): SessionState {
	const serialized = storage.getItem(STORAGE_KEY);
	if (!serialized) return initialState();

	try {
		const value: unknown = JSON.parse(serialized);
		if (!isRecord(value)) return initialState();
		const state = migrate(value.schemaVersion, value.state);
		if (isSessionState(state)) return state;
	} catch {
		return initialState();
	}

	return initialState();
}
