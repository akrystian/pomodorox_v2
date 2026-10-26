import { useState } from 'preact/hooks';
import { strings } from './strings';
import { ReloadPrompt } from './ReloadPrompt';
import { reduce } from './SessionModel';
import type { SessionState } from './SessionModel';
import { loadState, saveState } from './statePersistence';

export function App() {
	const [state, setState] = useState<SessionState>(() => loadState());
	const [name, setName] = useState('');
	const [estimate, setEstimate] = useState('1');
	const [error, setError] = useState<string | null>(null);

	const addTask = (event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
		event.preventDefault();
		const result = reduce(state, {
			type: 'ADD_TASK',
			at: Date.now(),
			id: crypto.randomUUID(),
			name,
			estimate,
		});
		setState(result.state);
		if (result.outcome.type === 'rejected') {
			setError(result.outcome.reason);
			return;
		}
		if (result.effects.some((effect) => effect.type === 'persist')) saveState(result.state);
		setName('');
		setEstimate('1');
		setError(null);
	};

	return (
		<main class="app">
			<section class="section" aria-labelledby="timer-heading">
				<h2 id="timer-heading">{strings.timer.heading}</h2>
				<p class="placeholder">{strings.timer.placeholder}</p>
			</section>
			<section class="section" aria-labelledby="tasks-heading">
				<h2 id="tasks-heading">{strings.tasks.heading}</h2>
				{state.tasks.length === 0 ? (
					<p class="placeholder">{strings.tasks.emptyHint}</p>
				) : (
					<ul class="task-list">
						{state.tasks.map((task) => (
							<li class="task" key={task.id}>
								<span>{task.name}</span>
								<span class="task-count">
									{task.pomodoroCount}/{task.estimate}
								</span>
							</li>
						))}
					</ul>
				)}
				<form class="task-form" onSubmit={addTask} noValidate>
					<label>
						{strings.tasks.nameLabel}
						<input
							name="name"
							value={name}
							onInput={(event) => setName(event.currentTarget.value)}
							required
						/>
					</label>
					<label>
						{strings.tasks.estimateLabel}
						<input
							name="estimate"
							type="number"
							min="1"
							step="1"
							value={estimate}
							onInput={(event) => setEstimate(event.currentTarget.value)}
							required
						/>
					</label>
					<button class="primary" type="submit">
						{strings.tasks.add}
					</button>
				</form>
				{error && (
					<p class="form-error" role="alert">
						{error}
					</p>
				)}
			</section>
			<section class="section" aria-labelledby="log-heading">
				<h2 id="log-heading">{strings.eventLog.heading}</h2>
				<p class="placeholder">{strings.eventLog.placeholder}</p>
			</section>
			<ReloadPrompt />
		</main>
	);
}
