import { describe, expect, it } from 'vitest';
import { initialState, reduce } from './SessionModel';

describe('SessionModel', () => {
	it('adds a named Task with its Estimate at the bottom of the list', () => {
		const state = {
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
