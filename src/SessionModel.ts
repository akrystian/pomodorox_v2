import { strings } from './strings';

export type Task = {
	id: string;
	name: string;
	estimate: number;
	pomodoroCount: number;
};

export type SessionState = {
	tasks: Task[];
};

export type SessionAction = {
	type: 'ADD_TASK';
	at: number;
	id: string;
	name: string;
	estimate?: number | string;
};

export type ReduceResult = {
	state: SessionState;
	outcome: { type: 'ok' } | { type: 'rejected'; reason: string };
	effects: { type: 'persist' }[];
};

export const initialState = (): SessionState => ({ tasks: [] });

export function reduce(state: SessionState, action: SessionAction): ReduceResult {
	const name = action.name.trim();
	if (!name) {
		return {
			state,
			outcome: { type: 'rejected', reason: strings.tasks.invalidName },
			effects: [],
		};
	}

	const estimate = Number(action.estimate ?? 1);
	if (!Number.isInteger(estimate) || estimate < 1) {
		return {
			state,
			outcome: { type: 'rejected', reason: strings.tasks.invalidEstimate },
			effects: [],
		};
	}

	const task: Task = {
		id: action.id,
		name,
		estimate,
		pomodoroCount: 0,
	};
	return {
		state: { ...state, tasks: [...state.tasks, task] },
		outcome: { type: 'ok' },
		effects: [{ type: 'persist' }],
	};
}
