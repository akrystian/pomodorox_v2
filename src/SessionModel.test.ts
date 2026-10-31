import { describe, expect, it } from 'vitest';
import { initialState, reduce, remaining, todaysEvents } from './SessionModel';

describe('SessionModel', () => {
	it('adds a named Task with its Estimate at the bottom of the list', () => {
		const state = {
			...initialState(),
			tasks: [
				{
					id: 'bd4473a4-cae1-4b1b-9a9c-2687f2df879e',
					name: 'Pierwsze zadanie',
					estimate: 1,
					pomodoroCount: 0,
				},
			],
		};
		const result = reduce(state, {
			type: 'ADD_TASK',
			at: 1_761_500_000_000,
			id: '8c443e19-e4ca-4d94-8215-22a564032f57',
			name: 'Raport kwartalny',
			estimate: 3,
		});

		expect(result).toEqual({
			state: {
				...initialState(),
				tasks: [
					{
						id: 'bd4473a4-cae1-4b1b-9a9c-2687f2df879e',
						name: 'Pierwsze zadanie',
						estimate: 1,
						pomodoroCount: 0,
					},
					{
						id: '8c443e19-e4ca-4d94-8215-22a564032f57',
						name: 'Raport kwartalny',
						estimate: 3,
						pomodoroCount: 0,
					},
				],
			},
			outcome: { type: 'ok' },
			effects: [{ type: 'persist' }],
		});
		expect(state.tasks).toEqual([
			{
				id: 'bd4473a4-cae1-4b1b-9a9c-2687f2df879e',
				name: 'Pierwsze zadanie',
				estimate: 1,
				pomodoroCount: 0,
			},
		]);
	});

	it('defaults a missing Estimate to 1', () => {
		const result = reduce(initialState(), {
			type: 'ADD_TASK',
			at: 1_761_500_000_000,
			id: '8c443e19-e4ca-4d94-8215-22a564032f57',
			name: 'Raport kwartalny',
		});

		expect(result.state.tasks[0]?.estimate).toBe(1);
	});

	it('rejects an empty name with a Polish message', () => {
		const state = initialState();
		const result = reduce(state, {
			type: 'ADD_TASK',
			at: 1_761_500_000_000,
			id: '8c443e19-e4ca-4d94-8215-22a564032f57',
			name: '  ',
			estimate: 1,
		});

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Zadanie musi mieć nazwę.' },
			effects: [],
		});
	});

	it.each(['', '1.5', '0', '-2', 'NaN'])('rejects invalid Estimate %j', (estimate) => {
		const state = initialState();
		const result = reduce(state, {
			type: 'ADD_TASK',
			at: 1_761_500_000_000,
			id: '8c443e19-e4ca-4d94-8215-22a564032f57',
			name: 'Raport kwartalny',
			estimate,
		});

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Estimate musi być liczbą całkowitą ≥ 1.' },
			effects: [],
		});
	});
});

describe('Task list shaping', () => {
	it('moves a Task to its new Priority without changing the others’ order', () => {
		const state = {
			...initialState(),
			tasks: [
				{ id: 'first', name: 'First', estimate: 1, pomodoroCount: 0 },
				{ id: 'second', name: 'Second', estimate: 2, pomodoroCount: 1 },
				{ id: 'third', name: 'Third', estimate: 3, pomodoroCount: 2 },
			],
			activeTaskId: 'second',
		};

		const result = reduce(state, { type: 'MOVE_TASK', id: 'third', toIndex: 0 });

		expect(result.state.tasks.map((task) => task.id)).toEqual(['third', 'first', 'second']);
		expect(result.state.activeTaskId).toBe('second');
		expect(result.effects).toEqual([{ type: 'persist' }]);
	});

	it('edits a Task name and Estimate while preserving its Pomodoro Count', () => {
		const state = {
			...initialState(),
			tasks: [{ id: 'task', name: 'Old name', estimate: 2, pomodoroCount: 3 }],
		};

		const result = reduce(state, {
			type: 'EDIT_TASK',
			id: 'task',
			name: '  New name  ',
			estimate: '5',
		});

		expect(result.state.tasks).toEqual([
			{ id: 'task', name: 'New name', estimate: 5, pomodoroCount: 3 },
		]);
		expect(result.effects).toEqual([{ type: 'persist' }]);
	});

	it('uses the same validation rules when editing a Task as when adding one', () => {
		const state = {
			...initialState(),
			tasks: [{ id: 'task', name: 'Existing', estimate: 2, pomodoroCount: 0 }],
		};

		expect(
			reduce(state, { type: 'EDIT_TASK', id: 'task', name: '  ', estimate: 2 }),
		).toMatchObject({ state, outcome: { type: 'rejected', reason: 'Zadanie musi mieć nazwę.' } });
		expect(
			reduce(state, { type: 'EDIT_TASK', id: 'task', name: 'Changed', estimate: '1.5' }),
		).toMatchObject({
			state,
			outcome: { type: 'rejected', reason: 'Estimate musi być liczbą całkowitą ≥ 1.' },
		});
	});
});

const T0 = 1_761_500_000_000;
const MIN = 60_000;
const REPORT_ID = '8c443e19-e4ca-4d94-8215-22a564032f57';
const MAIL_ID = 'bd4473a4-cae1-4b1b-9a9c-2687f2df879e';

const withTasks = () => {
	let state = initialState();
	state = reduce(state, { type: 'ADD_TASK', at: T0, id: REPORT_ID, name: 'Raport kwartalny', estimate: 4 }).state;
	state = reduce(state, { type: 'ADD_TASK', at: T0, id: MAIL_ID, name: 'Maile', estimate: 1 }).state;
	return state;
};

const runningWork = () => {
	const state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
	return reduce(state, { type: 'START', at: T0, kind: 'work' }).state;
};

describe('Active Task', () => {
	it('selecting a Task makes it the Active Task', () => {
		const result = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: MAIL_ID });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.activeTaskId).toBe(MAIL_ID);
		expect(result.effects).toEqual([{ type: 'persist' }]);
	});

	it('rejects selecting a Task that is not on the list', () => {
		const state = withTasks();
		const result = reduce(state, { type: 'SELECT_TASK', at: T0, id: 'missing' });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Nie ma takiego zadania.' },
			effects: [],
		});
	});
});

describe('Work Session', () => {
	it('rejects starting Work without an Active Task', () => {
		const state = withTasks();
		const result = reduce(state, { type: 'START', at: T0, kind: 'work' });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Najpierw wybierz zadanie.' },
			effects: [],
		});
	});

	it('starts a Work Session for the Active Task and records it as started', () => {
		const state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		const result = reduce(state, { type: 'START', at: T0 + 1000, kind: 'work' });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.session).toEqual({
			kind: 'work',
			taskId: REPORT_ID,
			startedAt: T0 + 1000,
			pausedAt: null,
			pausedTotal: 0,
		});
		expect(result.state.events).toEqual([
			{ at: T0 + 1000, type: 'started', kind: 'work', taskName: 'Raport kwartalny', durationMs: null },
		]);
		expect(result.effects).toEqual([{ type: 'persist' }, { type: 'permissionPrompt' }]);
	});

	it('locks the Active Task while Work is running', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'SELECT_TASK', at: T0 + MIN, id: MAIL_ID });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'W trakcie pracy nie można zmienić zadania.' },
			effects: [],
		});
	});

	it('leaves a Session running while it still has time left', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'TICK', at: T0 + 25 * MIN - 1 });

		expect(result).toEqual({ state, outcome: { type: 'ok' }, effects: [] });
	});

	it('completes Work at its scheduled end, counts a Pomodoro and keeps the Active Task', () => {
		const state = runningWork();

		// A throttled background tab ticks late; the Session still ends at T0 + 25 min.
		const result = reduce(state, { type: 'TICK', at: T0 + 25 * MIN + 7_000 });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.session).toBeNull();
		expect(result.state.activeTaskId).toBe(REPORT_ID);
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(result.state.events).toEqual([
			{ at: T0, type: 'started', kind: 'work', taskName: 'Raport kwartalny', durationMs: null },
			{ at: T0 + 25 * MIN, type: 'completed', kind: 'work', taskName: 'Raport kwartalny', durationMs: 25 * MIN },
		]);
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'banner', text: 'Praca zakończona: Raport kwartalny (1/4). Czas na przerwę.' },
		]);
	});
});

describe('Breaks', () => {
	it.each([
		['shortBreak', 5],
		['longBreak', 15],
	] as const)('%s runs %i minutes with no Task and completes with a break message', (kind, minutes) => {
		let state = reduce(initialState(), { type: 'START', at: T0, kind }).state;
		expect(state.session).toMatchObject({ kind, taskId: null });

		expect(reduce(state, { type: 'TICK', at: T0 + minutes * MIN - 1 }).state).toBe(state);

		const result = reduce(state, { type: 'TICK', at: T0 + minutes * MIN });
		state = result.state;

		expect(state.session).toBeNull();
		expect(state.events).toEqual([
			{ at: T0, type: 'started', kind, taskName: null, durationMs: null },
			{ at: T0 + minutes * MIN, type: 'completed', kind, taskName: null, durationMs: minutes * MIN },
		]);
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'banner', text: 'Przerwa zakończona. Wracamy do pracy?' },
		]);
	});

	it('lets the Active Task change during a break', () => {
		let state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		state = reduce(state, { type: 'START', at: T0, kind: 'shortBreak' }).state;

		const result = reduce(state, { type: 'SELECT_TASK', at: T0 + MIN, id: MAIL_ID });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.activeTaskId).toBe(MAIL_ID);
	});
});

describe('Stop', () => {
	it('abandons the running Session with its run time and leaves the Pomodoro Count alone', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'STOP', at: T0 + 12 * MIN });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.session).toBeNull();
		expect(result.state.activeTaskId).toBe(REPORT_ID);
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(0);
		expect(result.state.events.at(-1)).toEqual({
			at: T0 + 12 * MIN,
			type: 'abandoned',
			kind: 'work',
			taskName: 'Raport kwartalny',
			durationMs: 12 * MIN,
		});
		expect(result.effects).toEqual([{ type: 'persist' }]);
	});

	it('completes a Session whose time already ran out instead of abandoning it', () => {
		const state = runningWork();

		// No TICK reached the reducer between the scheduled end and the Stop.
		const result = reduce(state, { type: 'STOP', at: T0 + 25 * MIN + 30_000 });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.session).toBeNull();
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(result.state.events.at(-1)).toEqual({
			at: T0 + 25 * MIN,
			type: 'completed',
			kind: 'work',
			taskName: 'Raport kwartalny',
			durationMs: 25 * MIN,
		});
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'banner', text: 'Praca zakończona: Raport kwartalny (1/4). Czas na przerwę.' },
		]);
	});
});

describe('Switching Sessions', () => {
	it('asks for confirmation before starting a Session while one is running', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'START', at: T0 + MIN, kind: 'shortBreak' });

		expect(result).toEqual({
			state,
			outcome: { type: 'confirm', question: 'Porzucić bieżącą sesję?' },
			effects: [],
		});
	});

	it('on confirmation abandons the running Session and starts the new one', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'START', at: T0 + 20 * MIN, kind: 'longBreak', confirmed: true });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.session).toEqual({
			kind: 'longBreak',
			taskId: null,
			startedAt: T0 + 20 * MIN,
			pausedAt: null,
			pausedTotal: 0,
		});
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(0);
		expect(result.state.events).toEqual([
			{ at: T0, type: 'started', kind: 'work', taskName: 'Raport kwartalny', durationMs: null },
			{ at: T0 + 20 * MIN, type: 'abandoned', kind: 'work', taskName: 'Raport kwartalny', durationMs: 20 * MIN },
			{ at: T0 + 20 * MIN, type: 'started', kind: 'longBreak', taskName: null, durationMs: null },
		]);
	});

	it('rejects Work without an Active Task before asking to abandon a running break', () => {
		const state = reduce(withTasks(), { type: 'START', at: T0, kind: 'shortBreak' }).state;

		const result = reduce(state, { type: 'START', at: T0 + MIN, kind: 'work' });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Najpierw wybierz zadanie.' },
			effects: [],
		});
	});

	it('starts straight away, completing the previous Session, when its time already ran out', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'START', at: T0 + 25 * MIN + 30_000, kind: 'shortBreak' });

		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(result.state.events.slice(1)).toEqual([
			{ at: T0 + 25 * MIN, type: 'completed', kind: 'work', taskName: 'Raport kwartalny', durationMs: 25 * MIN },
			{ at: T0 + 25 * MIN + 30_000, type: 'started', kind: 'shortBreak', taskName: null, durationMs: null },
		]);
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'banner', text: 'Praca zakończona: Raport kwartalny (1/4). Czas na przerwę.' },
		]);
	});
});

describe('Pause and Resume', () => {
	it('freezes the time left however much time passes', () => {
		const paused = reduce(runningWork(), { type: 'PAUSE', at: T0 + 10 * MIN });

		expect(paused.outcome).toEqual({ type: 'ok' });
		expect(paused.effects).toEqual([{ type: 'persist' }]);
		expect(paused.state.events.at(-1)).toEqual({
			at: T0 + 10 * MIN,
			type: 'paused',
			kind: 'work',
			taskName: 'Raport kwartalny',
			durationMs: null,
		});
		const ticked = reduce(paused.state, { type: 'TICK', at: T0 + 10 * MIN + 100 * MIN });
		expect(ticked.state).toBe(paused.state);
		expect(remaining(paused.state.session!, T0 + 500 * MIN)).toBe(15 * MIN);
	});

	it('completes at the original duration plus the paused time and counts the Pomodoro', () => {
		let state = reduce(runningWork(), { type: 'PAUSE', at: T0 + 10 * MIN }).state;
		const resumed = reduce(state, { type: 'RESUME', at: T0 + 40 * MIN });
		state = resumed.state;

		expect(resumed.outcome).toEqual({ type: 'ok' });
		expect(state.events.at(-1)).toMatchObject({ at: T0 + 40 * MIN, type: 'resumed', durationMs: null });
		expect(reduce(state, { type: 'TICK', at: T0 + 55 * MIN - 1 }).state).toBe(state);

		const done = reduce(state, { type: 'TICK', at: T0 + 55 * MIN });
		expect(done.state.session).toBeNull();
		expect(done.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(done.state.events.at(-1)).toMatchObject({ at: T0 + 55 * MIN, type: 'completed', durationMs: 25 * MIN });
	});

	it('rejects Pause when already paused or no Session, and Resume when not paused', () => {
		const running = runningWork();
		const paused = reduce(running, { type: 'PAUSE', at: T0 + MIN }).state;

		for (const [state, type] of [
			[paused, 'PAUSE'],
			[running, 'RESUME'],
			[initialState(), 'PAUSE'],
			[initialState(), 'RESUME'],
		] as const) {
			const result = reduce(state, { type, at: T0 + 2 * MIN });
			expect(result.outcome.type).toBe('rejected');
			expect(result.state).toBe(state);
			expect(result.effects).toEqual([]);
		}
	});

	it('abandons a paused Session with the run time before the pause', () => {
		const paused = reduce(runningWork(), { type: 'PAUSE', at: T0 + 10 * MIN }).state;

		const result = reduce(paused, { type: 'STOP', at: T0 + 90 * MIN });

		expect(result.state.session).toBeNull();
		expect(result.state.events.at(-1)).toMatchObject({ type: 'abandoned', durationMs: 10 * MIN });
	});
});

describe('Reopen', () => {
	it('lets a Session with time left continue', () => {
		const state = runningWork();

		const result = reduce(state, { type: 'REOPEN', at: T0 + 10 * MIN });

		expect(result).toEqual({ state, outcome: { type: 'ok' }, effects: [] });
	});

	it('completes an elapsed Session at its scheduled end with only an in-app message', () => {
		const result = reduce(runningWork(), { type: 'REOPEN', at: T0 + 90 * MIN });

		expect(result.state.session).toBeNull();
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(result.state.events.at(-1)).toEqual({
			at: T0 + 25 * MIN,
			type: 'completed',
			kind: 'work',
			taskName: 'Raport kwartalny',
			durationMs: 25 * MIN,
		});
		expect(result.effects).toHaveLength(2);
		expect(result.effects[0]).toEqual({ type: 'persist' });
		expect(result.effects[1]).toMatchObject({ type: 'banner' });
		expect((result.effects[1] as { text: string }).text).toContain('aplikacja była zamknięta');
	});

	it('keeps a paused Session paused with the same time left', () => {
		const paused = reduce(runningWork(), { type: 'PAUSE', at: T0 + 10 * MIN }).state;

		const result = reduce(paused, { type: 'REOPEN', at: T0 + 500 * MIN });

		expect(result.state).toBe(paused);
		expect(result.effects).toEqual([]);
		expect(remaining(result.state.session!, T0 + 500 * MIN)).toBe(15 * MIN);
	});
});

describe('Session announcements', () => {
	it('completes an elapsed Session silently when reopening the app', () => {
		const result = reduce(runningWork(), { type: 'TICK', at: T0 + 25 * MIN, silent: true });

		expect(result.state.session).toBeNull();
		expect(result.state.tasks.find((task) => task.id === REPORT_ID)?.pomodoroCount).toBe(1);
		expect(result.effects).toEqual([{ type: 'persist' }]);
	});

	it('announces completed Work with sound, a system notification, and a banner', () => {
		const state = withTasks();
		const selected = reduce(state, { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		const started = reduce(
			{
				...selected,
				tasks: selected.tasks.map((task) =>
					task.id === REPORT_ID ? { ...task, pomodoroCount: 2 } : task,
				),
				notificationPermission: 'granted',
				permissionPrompted: true,
			},
			{ type: 'START', at: T0, kind: 'work' },
		).state;

		const result = reduce(started, { type: 'TICK', at: T0 + 25 * MIN });

		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'notification', text: 'Praca zakończona: Raport kwartalny (3/4). Czas na przerwę.' },
			{ type: 'banner', text: 'Praca zakończona: Raport kwartalny (3/4). Czas na przerwę.' },
		]);
	});

	it('announces completed breaks with sound, a system notification, and a banner', () => {
		const started = reduce(
			{ ...initialState(), notificationPermission: 'granted', permissionPrompted: true },
			{ type: 'START', at: T0, kind: 'shortBreak' },
		).state;

		const result = reduce(started, { type: 'TICK', at: T0 + 5 * MIN });

		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'notification', text: 'Przerwa zakończona…' },
			{ type: 'banner', text: 'Przerwa zakończona. Wracamy do pracy?' },
		]);
	});

	it('keeps the in-app banner when sound is off and notifications are denied', () => {
		const denied = reduce(
			{ ...initialState(), notificationPermission: 'denied' as const, permissionPrompted: true },
			{ type: 'TOGGLE_SOUND' },
		).state;
		const started = reduce(denied, { type: 'START', at: T0, kind: 'shortBreak' }).state;

		const result = reduce(started, { type: 'TICK', at: T0 + 5 * MIN });

		expect(denied.soundEnabled).toBe(false);
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'banner', text: 'Przerwa zakończona. Wracamy do pracy?' },
		]);
	});

	it('omits system notifications when the notifications switch is off', () => {
		const enabled = { ...initialState(), notificationPermission: 'granted' as const, permissionPrompted: true };
		const disabled = reduce(enabled, { type: 'TOGGLE_NOTIFICATIONS' }).state;
		const started = reduce(disabled, { type: 'START', at: T0, kind: 'shortBreak' }).state;

		const result = reduce(started, { type: 'TICK', at: T0 + 5 * MIN });

		expect(disabled.notificationsEnabled).toBe(false);
		expect(result.effects).toEqual([
			{ type: 'persist' },
			{ type: 'sound' },
			{ type: 'banner', text: 'Przerwa zakończona. Wracamy do pracy?' },
		]);
	});

	it('rejects enabling notifications after permission is denied', () => {
		const state = { ...initialState(), notificationPermission: 'denied' as const };

		const result = reduce(state, { type: 'TOGGLE_NOTIFICATIONS' });

		expect(result.outcome.type).toBe('rejected');
		expect(result.state).toBe(state);
		expect(result.effects).toEqual([]);
	});

	it('prompts for notification permission only on the first START', () => {
		const first = reduce(initialState(), { type: 'START', at: T0, kind: 'shortBreak' });

		expect(first.effects).toContainEqual({ type: 'permissionPrompt' });

		const answered = reduce(first.state, { type: 'PERMISSION_ANSWER', permission: 'granted' });
		const second = reduce(answered.state, {
			type: 'START',
			at: T0 + MIN,
			kind: 'longBreak',
			confirmed: true,
		});

		expect(second.effects).not.toContainEqual({ type: 'permissionPrompt' });
	});
});

describe('Event Log', () => {
	const at = (h: number, d = 0) => new Date(2026, 0, 10 + d, h).getTime();
	const ev = (t: number) => ({ at: t, type: 'started' as const, kind: 'work' as const, taskName: null, durationMs: null });

	it("selects only today's Events, newest first", () => {
		const events = [ev(at(23, -1)), ev(at(9)), ev(at(10))];
		expect(todaysEvents(events, at(12))).toEqual([ev(at(10)), ev(at(9))]);
	});

	it('asks for confirmation before clearing', () => {
		const state = { ...runningWork(), events: [ev(T0)] };
		expect(reduce(state, { type: 'CLEAR_LOG', at: T0 })).toEqual({
			state,
			outcome: { type: 'confirm', question: 'Usunąć wszystkie zdarzenia, także z poprzednich dni?' },
			effects: [],
		});
	});

	it('removes all Events when confirmed, keeping counts and the running Session', () => {
		const base = runningWork();
		const state = {
			...base,
			tasks: base.tasks.map((t) => ({ ...t, pomodoroCount: 2 })),
			events: [ev(at(9, -3)), ev(at(9))],
		};
		const result = reduce(state, { type: 'CLEAR_LOG', at: at(12), confirmed: true });
		expect(result.outcome).toEqual({ type: 'ok' });
		expect(result.state).toEqual({ ...state, events: [] });
	});

	it('logs a Session completing after a clear as the first row', () => {
		const cleared = reduce(runningWork(), { type: 'CLEAR_LOG', at: T0 + MIN, confirmed: true }).state;
		const done = reduce(cleared, { type: 'TICK', at: T0 + 30 * MIN }).state;
		expect(done.events).toHaveLength(1);
		expect(todaysEvents(done.events, T0 + 30 * MIN)[0]).toMatchObject({ type: 'completed' });
	});
});
