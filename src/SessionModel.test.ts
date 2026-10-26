import { describe, expect, it } from 'vitest';
import { initialState, reduce } from './SessionModel';

describe('SessionModel', () => {
	it('adds a named Task with its Estimate at the bottom of the list', () => {
		const state = initialState();
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
		expect(state.tasks).toEqual([]);
	});
});
