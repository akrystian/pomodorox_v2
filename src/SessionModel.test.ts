import { describe, expect, it } from 'vitest';
import { initialState, reduce, remaining } from './SessionModel';

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
		expect(result.effects).toEqual([{ type: 'persist' }]);
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
