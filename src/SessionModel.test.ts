import { describe, expect, it } from 'vitest';
import { initialState, reduce } from './SessionModel';

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
		let state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		state = reduce(state, { type: 'START', at: T0, kind: 'work' }).state;

		const result = reduce(state, { type: 'SELECT_TASK', at: T0 + MIN, id: MAIL_ID });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'W trakcie pracy nie można zmienić zadania.' },
			effects: [],
		});
	});

	it('leaves a Session running while it still has time left', () => {
		let state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		state = reduce(state, { type: 'START', at: T0, kind: 'work' }).state;

		const result = reduce(state, { type: 'TICK', at: T0 + 25 * MIN - 1 });

		expect(result).toEqual({ state, outcome: { type: 'ok' }, effects: [] });
	});

	it('completes Work at its scheduled end, counts a Pomodoro and keeps the Active Task', () => {
		let state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		state = reduce(state, { type: 'START', at: T0, kind: 'work' }).state;

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

	it('rejects starting a Session while one is already running', () => {
		let state = reduce(withTasks(), { type: 'SELECT_TASK', at: T0, id: REPORT_ID }).state;
		state = reduce(state, { type: 'START', at: T0, kind: 'work' }).state;

		const result = reduce(state, { type: 'START', at: T0 + MIN, kind: 'work' });

		expect(result).toEqual({
			state,
			outcome: { type: 'rejected', reason: 'Sesja już trwa.' },
			effects: [],
		});
	});
});
