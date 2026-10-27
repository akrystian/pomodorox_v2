import { strings } from './strings';

export const SESSION_KINDS = ['work', 'shortBreak', 'longBreak'] as const;

export type SessionKind = (typeof SESSION_KINDS)[number];

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

export const EVENT_TYPES = ['started', 'completed', 'abandoned', 'paused', 'resumed'] as const;

export type SessionEvent = {
	at: number;
	type: (typeof EVENT_TYPES)[number];
	kind: SessionKind;
	taskName: string | null;
	/** Only for completed and abandoned Events. */
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
	| { type: 'START'; at: number; kind: SessionKind; confirmed?: boolean }
	| { type: 'STOP'; at: number }
	| { type: 'PAUSE'; at: number }
	| { type: 'RESUME'; at: number }
	| { type: 'TICK'; at: number };

export type ReduceResult = {
	state: SessionState;
	outcome: Outcome;
	effects: Effect[];
};

export type Outcome =
	| { type: 'ok' }
	| { type: 'rejected'; reason: string }
	| { type: 'confirm'; question: string };

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

type Settled = { state: SessionState; effects: Effect[] };

// A Session whose time ran out is Completed at its scheduledEnd, whichever action
// reaches the reducer first, so a late TICK, STOP or START never abandons it.
function completeIfElapsed(state: SessionState, at: number): Settled {
	const { session } = state;
	if (!session || session.pausedAt !== null || remaining(session, at) > 0) {
		return { state, effects: [] };
	}
	return complete({ ...state, session }, scheduledEnd(session));
}

function complete(state: SessionState & { session: Session }, at: number): Settled {
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
	return { state: { ...next, session: null }, effects: [{ type: 'banner', text }] };
}

const abandon = (state: SessionState & { session: Session }, at: number): SessionState => ({
	...logEvent(state, at, 'abandoned', runTime(state.session, at)),
	session: null,
});

const needConfirm = (state: SessionState, question: string): ReduceResult => ({
	state,
	outcome: { type: 'confirm', question },
	effects: [],
});

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
			if (action.kind === 'work' && state.activeTaskId === null) {
				return reject(state, strings.timer.noActiveTask);
			}
			const settled = completeIfElapsed(state, action.at);
			if (settled.state.session && !action.confirmed) {
				return needConfirm(state, strings.timer.confirmAbandon);
			}
			const current = settled.state.session
				? abandon({ ...settled.state, session: settled.state.session }, action.at)
				: settled.state;
			const session: Session = {
				kind: action.kind,
				taskId: action.kind === 'work' ? current.activeTaskId : null,
				startedAt: action.at,
				pausedAt: null,
				pausedTotal: 0,
			};
			return ok(logEvent({ ...current, session }, action.at, 'started'), settled.effects);
		}

		case 'STOP': {
			const settled = completeIfElapsed(state, action.at);
			if (settled.state !== state) return ok(settled.state, settled.effects);
			const { session } = state;
			if (!session) return reject(state, strings.timer.noSession);
			return ok(abandon({ ...state, session }, action.at));
		}

		case 'PAUSE': {
			const settled = completeIfElapsed(state, action.at);
			if (settled.state !== state) return ok(settled.state, settled.effects);
			const { session } = state;
			if (!session) return reject(state, strings.timer.noSession);
			if (session.pausedAt !== null) return reject(state, strings.timer.alreadyPaused);
			return ok(logEvent({ ...state, session: { ...session, pausedAt: action.at } }, action.at, 'paused'));
		}

		case 'RESUME': {
			const { session } = state;
			if (!session) return reject(state, strings.timer.noSession);
			if (session.pausedAt === null) return reject(state, strings.timer.notPaused);
			const resumed: Session = {
				...session,
				pausedAt: null,
				pausedTotal: session.pausedTotal + (action.at - session.pausedAt),
			};
			return ok(logEvent({ ...state, session: resumed }, action.at, 'resumed'));
		}

		case 'TICK': {
			const settled = completeIfElapsed(state, action.at);
			if (settled.state === state) return { state, outcome: { type: 'ok' }, effects: [] };
			return ok(settled.state, settled.effects);
		}
	}
}
