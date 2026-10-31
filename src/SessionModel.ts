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
	doneTasks: Task[];
	activeTaskId: string | null;
	session: Session | null;
	events: SessionEvent[];
	soundEnabled: boolean;
	notificationsEnabled: boolean;
	notificationPermission: NotificationPermission;
	permissionPrompted: boolean;
};

export type SessionAction =
	| {
			type: 'ADD_TASK';
			at: number;
			id: string;
			name: string;
			estimate?: number | string;
	  }
	| { type: 'EDIT_TASK'; id: string; name: string; estimate?: number | string }
	| { type: 'MOVE_TASK'; id: string; toIndex: number }
	| { type: 'MARK_DONE'; at: number; id: string; confirmed?: boolean }
	| { type: 'RESTORE'; id: string }
	| { type: 'SELECT_TASK'; at: number; id: string }
	| { type: 'START'; at: number; kind: SessionKind; confirmed?: boolean }
	| { type: 'STOP'; at: number }
	| { type: 'PAUSE'; at: number }
	| { type: 'RESUME'; at: number }
	| { type: 'TICK'; at: number; silent?: boolean }
	| { type: 'REOPEN'; at: number }
	| { type: 'TOGGLE_SOUND' }
	| { type: 'TOGGLE_NOTIFICATIONS' }
	| { type: 'PERMISSION_ANSWER'; permission: NotificationPermission }
	| { type: 'CLEAR_LOG'; at: number; confirmed?: boolean };

export type ReduceResult = {
	state: SessionState;
	outcome: Outcome;
	effects: Effect[];
};

export type Outcome =
	| { type: 'ok' }
	| { type: 'rejected'; reason: string }
	| { type: 'confirm'; question: string };

export type Effect =
	| { type: 'persist' }
	| { type: 'banner'; text: string }
	| { type: 'sound' }
	| { type: 'notification'; text: string }
	| { type: 'permissionPrompt' };

// Time is derived from timestamps, never counted by ticks (ADR-0001).
const runTime = (session: Session, at: number) =>
	at - session.startedAt - session.pausedTotal - (session.pausedAt !== null ? at - session.pausedAt : 0);

export const remaining = (session: Session, at: number) =>
	Math.max(0, DURATIONS[session.kind] - runTime(session, at));

const scheduledEnd = (session: Session) =>
	session.startedAt + session.pausedTotal + DURATIONS[session.kind];

/** Today's Events (from local midnight), newest first. */
export const todaysEvents = (events: SessionEvent[], now: number): SessionEvent[] => {
	const midnight = new Date(now).setHours(0, 0, 0, 0);
	return events.filter((event) => event.at >= midnight).reverse();
};

export const initialState = (): SessionState => ({
	tasks: [],
	doneTasks: [],
	activeTaskId: null,
	session: null,
	events: [],
	soundEnabled: true,
	notificationsEnabled: true,
	notificationPermission: 'default',
	permissionPrompted: false,
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
function completeIfElapsed(state: SessionState, at: number, announce = true): Settled {
	const { session } = state;
	if (!session || session.pausedAt !== null || remaining(session, at) > 0) {
		return { state, effects: [] };
	}
	return complete({ ...state, session }, scheduledEnd(session), announce);
}

function complete(state: SessionState & { session: Session }, at: number, announce = true): Settled {
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
	const effects: Effect[] = [];
	if (announce) {
		if (state.soundEnabled) effects.push({ type: 'sound' });
		if (state.notificationsEnabled && state.notificationPermission === 'granted') {
			effects.push({
				type: 'notification',
				text: task ? text : strings.timer.breakNotification,
			});
		}
		effects.push({ type: 'banner', text });
	}
	return { state: { ...next, session: null }, effects };
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

const validateTaskDetails = (
	name: string,
	estimateValue: number | string | undefined,
): { name: string; estimate: number } | string => {
	const trimmedName = name.trim();
	if (!trimmedName) return strings.tasks.invalidName;

	const estimate = Number(estimateValue ?? 1);
	if (!Number.isInteger(estimate) || estimate < 1) return strings.tasks.invalidEstimate;

	return { name: trimmedName, estimate };
};

export function reduce(state: SessionState, action: SessionAction): ReduceResult {
	switch (action.type) {
		case 'ADD_TASK': {
			const details = validateTaskDetails(action.name, action.estimate);
			if (typeof details === 'string') return reject(state, details);

			const task: Task = {
				id: action.id,
				...details,
				pomodoroCount: 0,
			};
			return ok({ ...state, tasks: [...state.tasks, task] });
		}

		case 'EDIT_TASK': {
			if (!state.tasks.some((task) => task.id === action.id)) {
				return reject(state, strings.tasks.unknownTask);
			}
			const details = validateTaskDetails(action.name, action.estimate);
			if (typeof details === 'string') return reject(state, details);

			return ok({
				...state,
				tasks: state.tasks.map((task) => (task.id === action.id ? { ...task, ...details } : task)),
			});
		}

		case 'MOVE_TASK': {
			const fromIndex = state.tasks.findIndex((task) => task.id === action.id);
			if (fromIndex === -1) return reject(state, strings.tasks.unknownTask);
			if (!Number.isInteger(action.toIndex) || action.toIndex < 0 || action.toIndex >= state.tasks.length) {
				return reject(state, strings.tasks.invalidPosition);
			}
			if (fromIndex === action.toIndex) return ok(state);

			const tasks = [...state.tasks];
			const [task] = tasks.splice(fromIndex, 1);
			tasks.splice(action.toIndex, 0, task!);
			return ok({ ...state, tasks });
		}

		case 'MARK_DONE': {
			const task = state.tasks.find((candidate) => candidate.id === action.id);
			if (!task) return reject(state, strings.tasks.unknownTask);
			const settled = completeIfElapsed(state, action.at);
			const session = settled.state.session;
			const abandoningWork = session?.kind === 'work' && session.taskId === action.id;
			if (abandoningWork && !action.confirmed) {
				return needConfirm(state, strings.tasks.confirmDoneAbandon);
			}
			const current =
				abandoningWork && session
					? abandon({ ...settled.state, session }, action.at)
					: settled.state;
			return ok({
				...current,
				tasks: current.tasks.filter((candidate) => candidate.id !== action.id),
				doneTasks: [...current.doneTasks, task],
				activeTaskId: current.activeTaskId === action.id ? null : current.activeTaskId,
			}, settled.effects);
		}

		case 'RESTORE': {
			const task = state.doneTasks.find((candidate) => candidate.id === action.id);
			if (!task) return reject(state, strings.tasks.unknownTask);
			return ok({
				...state,
				tasks: [...state.tasks, task],
				doneTasks: state.doneTasks.filter((candidate) => candidate.id !== action.id),
			});
		}

		case 'DELETE': {
			const exists =
				state.tasks.some((task) => task.id === action.id) ||
				state.doneTasks.some((task) => task.id === action.id);
			if (!exists) return reject(state, strings.tasks.unknownTask);

			const settled = completeIfElapsed(state, action.at);
			const session = settled.state.session;
			const abandoningWork = session?.kind === 'work' && session.taskId === action.id;
			if (!action.confirmed) {
				return needConfirm(
					state,
					abandoningWork ? strings.tasks.confirmDeleteAbandon : strings.tasks.confirmDelete,
				);
			}
			const current =
				abandoningWork && session
					? abandon({ ...settled.state, session }, action.at)
					: settled.state;
			return ok({
				...current,
				tasks: current.tasks.filter((task) => task.id !== action.id),
				doneTasks: current.doneTasks.filter((task) => task.id !== action.id),
				activeTaskId: current.activeTaskId === action.id ? null : current.activeTaskId,
			}, settled.effects);
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
			const permissionEffects: Effect[] = state.permissionPrompted ? [] : [{ type: 'permissionPrompt' }];
			return ok(
				logEvent(
					{ ...current, session, permissionPrompted: true },
					action.at,
					'started',
				),
				[...settled.effects, ...permissionEffects],
			);
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

		case 'REOPEN': {
			const settled = completeIfElapsed(state, action.at);
			if (settled.state === state) return { state, outcome: { type: 'ok' }, effects: [] };
			// Silent: only the in-app banner, no sound or system notification.
			const effects = settled.effects.flatMap((effect): Effect[] =>
				effect.type === 'banner' ? [{ ...effect, text: strings.timer.endedWhileClosed(effect.text) }] : [],
			);
			return ok(settled.state, effects);
		}

		case 'CLEAR_LOG':
			if (!action.confirmed) return needConfirm(state, strings.eventLog.confirmClear);
			return ok({ ...state, events: [] });

		case 'TICK': {
			const settled = completeIfElapsed(state, action.at, !action.silent);
			if (settled.state === state) return { state, outcome: { type: 'ok' }, effects: [] };
			return ok(settled.state, settled.effects);
		}

		case 'TOGGLE_SOUND':
			return ok({ ...state, soundEnabled: !state.soundEnabled });

		case 'TOGGLE_NOTIFICATIONS':
			if (state.notificationPermission === 'denied') {
				return reject(state, strings.settings.notificationsDenied);
			}
			return ok({ ...state, notificationsEnabled: !state.notificationsEnabled });

		case 'PERMISSION_ANSWER':
			return ok({ ...state, notificationPermission: action.permission });
	}
}
