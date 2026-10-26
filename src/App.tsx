import { useEffect, useRef, useState } from 'preact/hooks';
import { strings } from './strings';
import { ReloadPrompt } from './ReloadPrompt';
import { DURATIONS, reduce, remaining } from './SessionModel';
import type { SessionAction, SessionState } from './SessionModel';
import { loadState, saveState } from './statePersistence';

const pad = (n: number) => String(n).padStart(2, '0');

// Rounds up, so a fresh Session shows 25:00 and 00:00 only at the very end.
const formatRemaining = (ms: number) => {
	const seconds = Math.ceil(ms / 1000);
	return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

export function App() {
	const [state, setState] = useState<SessionState>(() => loadState());
	const stateRef = useRef(state);
	const [now, setNow] = useState(() => Date.now());
	const [banner, setBanner] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [estimate, setEstimate] = useState('1');
	const [error, setError] = useState<string | null>(null);

	const dispatch = (action: SessionAction) => {
		const result = reduce(stateRef.current, action);
		stateRef.current = result.state;
		setState(result.state);
		for (const effect of result.effects) {
			if (effect.type === 'persist') saveState(result.state);
			if (effect.type === 'banner') setBanner(effect.text);
		}
		return result.outcome;
	};

	// Clock driver: ticks about once a second while a Session runs, and as soon as
	// the tab becomes visible again so a throttled background tab catches up.
	const { session } = state;
	useEffect(() => {
		if (!session) return;
		const tick = () => {
			const at = Date.now();
			setNow(at);
			dispatch({ type: 'TICK', at });
		};
		tick();
		const interval = setInterval(tick, 1000);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', tick);
		};
	}, [session]);

	const timeLeft = session ? remaining(session, now) : DURATIONS.work;

	useEffect(() => {
		document.title = session
			? `${formatRemaining(timeLeft)} · ${strings.timer.kinds[session.kind]}`
			: strings.appName;
	}, [session, timeLeft]);

	const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
	const workLocked = session?.kind === 'work';

	const startWork = () => {
		setBanner(null);
		const at = Date.now();
		setNow(at);
		dispatch({ type: 'START', at, kind: 'work' });
	};

	const addTask = (event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
		event.preventDefault();
		const outcome = dispatch({
			type: 'ADD_TASK',
			at: Date.now(),
			id: crypto.randomUUID(),
			name,
			estimate,
		});
		if (outcome.type === 'rejected') {
			setError(outcome.reason);
			return;
		}
		setName('');
		setEstimate('1');
		setError(null);
	};

	return (
		<main class="app">
			<section class="section" aria-labelledby="timer-heading">
				<h2 id="timer-heading">{strings.timer.heading}</h2>
				<p class="time-left" role="timer">
					{formatRemaining(timeLeft)}
				</p>
				{activeTask && (
					<p class="active-task">
						{activeTask.name}{' '}
						<span class="task-count">
							{activeTask.pomodoroCount}/{activeTask.estimate}
						</span>
					</p>
				)}
				<div class="timer-actions">
					<button
						class="primary"
						type="button"
						onClick={startWork}
						disabled={!activeTask || session !== null}
						aria-describedby={activeTask ? undefined : 'work-hint'}
					>
						{strings.timer.startWork}
					</button>
				</div>
				{!activeTask && (
					<p id="work-hint" class="placeholder">
						{strings.timer.noActiveTask}
					</p>
				)}
				{banner && (
					<div class="banner" role="status">
						<span>{banner}</span>
						<button type="button" onClick={() => setBanner(null)}>
							{strings.timer.dismiss}
						</button>
					</div>
				)}
			</section>
			<section class="section" aria-labelledby="tasks-heading">
				<h2 id="tasks-heading">{strings.tasks.heading}</h2>
				{state.tasks.length === 0 ? (
					<p class="placeholder">{strings.tasks.emptyHint}</p>
				) : (
					<ul class="task-list">
						{state.tasks.map((task) => (
							<li key={task.id}>
								<button
									class={`task${task.id === state.activeTaskId ? ' active' : ''}`}
									type="button"
									aria-pressed={task.id === state.activeTaskId}
									disabled={workLocked && task.id !== state.activeTaskId}
									title={workLocked ? strings.tasks.activeTaskLocked : undefined}
									onClick={() => dispatch({ type: 'SELECT_TASK', at: Date.now(), id: task.id })}
								>
									<span>{task.name}</span>
									<span class="task-count">
										{task.pomodoroCount}/{task.estimate}
									</span>
								</button>
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
