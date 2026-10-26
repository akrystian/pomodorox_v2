import { strings } from './strings';

export type SessionKind = 'work' | 'shortBreak' | 'longBreak';

const MIN = 60_000;

/** One fixed duration per Session Kind. */
export const DURATIONS: Record<SessionKind, number> = {
	work: 25 * MIN,
	shortBreak: 5 * MIN,
	longBreak: 15 * MIN,
};

export type Task = {
	id: string;
	name: string;
	estimate: number;
	pomodoroCount: number;
};

export type Session = {
	kind: SessionKind;
	/** null for breaks. */
	taskId: string | null;
	startedAt: number;
	/** null unless paused. */
	pausedAt: number | null;
	pausedTotal: number;
};

export type SessionEvent = {
	at: number;
	type: 'started' | 'completed';
	kind: SessionKind;
	taskName: string | null;
	/** Only for completed (and later abandoned) Events. */
	durationMs: number | null;
};

export type SessionState = {
	tasks: Task[];
	activeTaskId: string | null;
	session: Session | null;
	events: SessionEvent[];
};

export type SessionAction =
	| {
			type: 'ADD_TASK';
			at: number;
			id: string;
			name: string;
			estimate?: number | string;
	  }
	| { type: 'SELECT_TASK'; at: number; id: string }
	| { type: 'START'; at: number; kind: SessionKind }
	| { type: 'TICK'; at: number };

export type ReduceResult = {
	state: SessionState;
	outcome: { type: 'ok' } | { type: 'rejected'; reason: string };
	effects: Effect[];
};

export type Effect = { type: 'persist' } | { type: 'banner'; text: string };

// Time is derived from timestamps, never counted by ticks (ADR-0001).
const runTime = (session: Session, at: number) =>
	at - session.startedAt - session.pausedTotal - (session.pausedAt !== null ? at - session.pausedAt : 0);

export const remaining = (session: Session, at: number) =>
	Math.max(0, DURATIONS[session.kind] - runTime(session, at));

const scheduledEnd = (session: Session) =>
	session.startedAt + session.pausedTotal + DURATIONS[session.kind];

export const initialState = (): SessionState => ({
	tasks: [],
	activeTaskId: null,
	session: null,
	events: [],
});

const ok = (state: SessionState, effects: Effect[] = []): ReduceResult => ({
	state,
	outcome: { type: 'ok' },
	effects: [{ type: 'persist' }, ...effects],
});

const taskName = (state: SessionState, id: string | null) =>
	state.tasks.find((task) => task.id === id)?.name ?? null;

const logEvent = (
	state: SessionState & { session: Session },
	at: number,
	type: SessionEvent['type'],
	durationMs: number | null = null,
): SessionState => ({
	...state,
	events: [
		...state.events,
		{ at, type, kind: state.session.kind, taskName: taskName(state, state.session.taskId), durationMs },
	],
});

function complete(state: SessionState & { session: Session }, at: number): ReduceResult {
	const { kind, taskId } = state.session;
	let next = logEvent(state, at, 'completed', DURATIONS[kind]);
	if (kind === 'work') {
		next = {
			...next,
			tasks: next.tasks.map((task) =>
				task.id === taskId ? { ...task, pomodoroCount: task.pomodoroCount + 1 } : task,
			),
		};
	}
	const task = next.tasks.find((candidate) => candidate.id === taskId);
	const text = task
		? strings.timer.workCompleted(task.name, task.pomodoroCount, task.estimate)
		: strings.timer.breakCompleted;
	return ok({ ...next, session: null }, [{ type: 'banner', text }]);
}

const reject = (state: SessionState, reason: string): ReduceResult => ({
	state,
	outcome: { type: 'rejected', reason },
	effects: [],
});

export function reduce(state: SessionState, action: SessionAction): ReduceResult {
	switch (action.type) {
		case 'ADD_TASK': {
			const name = action.name.trim();
			if (!name) return reject(state, strings.tasks.invalidName);

			const estimate = Number(action.estimate ?? 1);
			if (!Number.isInteger(estimate) || estimate < 1) {
				return reject(state, strings.tasks.invalidEstimate);
			}

			const task: Task = {
				id: action.id,
				name,
				estimate,
				pomodoroCount: 0,
			};
			return ok({ ...state, tasks: [...state.tasks, task] });
		}

		case 'SELECT_TASK':
			if (!state.tasks.some((task) => task.id === action.id)) {
				return reject(state, strings.tasks.unknownTask);
			}
			if (state.session?.kind === 'work' && action.id !== state.activeTaskId) {
				return reject(state, strings.tasks.activeTaskLocked);
			}
			return ok({ ...state, activeTaskId: action.id });

		case 'START': {
			// Switching Sessions with confirmation comes later; until then one at a time.
			if (state.session) return reject(state, strings.timer.sessionRunning);
			if (action.kind === 'work' && state.activeTaskId === null) {
				return reject(state, strings.timer.noActiveTask);
			}
			const session: Session = {
				kind: action.kind,
				taskId: action.kind === 'work' ? state.activeTaskId : null,
				startedAt: action.at,
				pausedAt: null,
				pausedTotal: 0,
			};
			return ok(logEvent({ ...state, session }, action.at, 'started'));
		}

		case 'TICK': {
			const { session } = state;
			if (!session || session.pausedAt !== null || remaining(session, action.at) > 0) {
				return { state, outcome: { type: 'ok' }, effects: [] };
			}
			return complete({ ...state, session }, scheduledEnd(session));
		}
	}
}
