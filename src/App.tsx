import { useEffect, useRef, useState } from 'preact/hooks';
import { strings } from './strings';
import { ReloadPrompt } from './ReloadPrompt';
import { ConfirmDialog } from './ConfirmDialog';
import { DURATIONS, SESSION_KINDS, reduce, remaining, todaysEvents } from './SessionModel';
import type { SessionAction, SessionState } from './SessionModel';
import { loadState, saveState } from './statePersistence';

type StartAction = Extract<SessionAction, { type: 'START' }>;
type PendingAction = StartAction | Extract<SessionAction, { type: 'CLEAR_LOG' | 'MARK_DONE' | 'DELETE' }>;

const pad = (n: number) => String(n).padStart(2, '0');

// Rounds up, so a fresh Session shows 25:00 and 00:00 only at the very end.
const formatClock = (at: number) => {
	const date = new Date(at);
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatRemaining = (ms: number) => {
	const seconds = Math.ceil(ms / 1000);
	return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

export function App() {
	const [state, setState] = useState<SessionState>(() => loadState());
	const stateRef = useRef(state);
	const initialSession = useRef(state.session !== null);
	const [now, setNow] = useState(() => Date.now());
	const [banner, setBanner] = useState<string | null>(null);
	const [pending, setPending] = useState<{ action: PendingAction; question: string } | null>(null);
	const [name, setName] = useState('');
	const [estimate, setEstimate] = useState('1');
	const [error, setError] = useState<string | null>(null);
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const taskListRef = useRef<HTMLUListElement>(null);
	const draggedTaskId = useRef<string | null>(null);
	const draggedPointerId = useRef<number | null>(null);
	const draggedToIndex = useRef<number | null>(null);

	const dispatch = (action: SessionAction) => {
		const result = reduce(stateRef.current, action);
		stateRef.current = result.state;
		setState(result.state);
		for (const effect of result.effects) {
			if (effect.type === 'persist') saveState(result.state);
			if (effect.type === 'banner') setBanner(effect.text);
			if (effect.type === 'sound') {
				const audio = new Audio(`${import.meta.env.BASE_URL}session-end.wav`);
				void audio.play().catch(() => {});
			}
			if (effect.type === 'notification' && typeof Notification !== 'undefined') {
				if (Notification.permission === 'granted') {
					try {
						new Notification(strings.appName, { body: effect.text });
					} catch {
						// Permission may have changed since the reducer emitted the effect.
					}
				}
			}
			if (effect.type === 'permissionPrompt') {
				if (typeof Notification === 'undefined') {
					dispatch({ type: 'PERMISSION_ANSWER', permission: 'denied' });
				} else {
					void Notification.requestPermission()
						.then((permission) => dispatch({ type: 'PERMISSION_ANSWER', permission }))
						.catch(() => dispatch({ type: 'PERMISSION_ANSWER', permission: 'denied' }));
				}
			}
		}
		return result.outcome;
	};

	useEffect(() => {
		if (
			typeof Notification !== 'undefined' &&
			Notification.permission !== stateRef.current.notificationPermission
		) {
			dispatch({ type: 'PERMISSION_ANSWER', permission: Notification.permission });
		}
	}, []);

	// On startup, settle a Session whose time ran out while the app was closed.
	useEffect(() => {
		const at = Date.now();
		setNow(at);
		dispatch({ type: 'REOPEN', at });
	}, []);

	// Clock driver: ticks about once a second while a Session runs, and as soon as
	// the tab becomes visible again so a throttled background tab catches up.
	const { session } = state;
	useEffect(() => {
		if (!session) return;
		const tick = (silent = false) => {
			const at = Date.now();
			setNow(at);
			dispatch({ type: 'TICK', at, silent });
		};
		tick(initialSession.current);
		initialSession.current = false;
		const refresh = () => tick();
		const interval = setInterval(refresh, 1000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', refresh);
		};
	}, [session]);

	const timeLeft = session ? remaining(session, now) : DURATIONS.work;

	useEffect(() => {
		document.title = session
			? `${formatRemaining(timeLeft)} · ${strings.timer.kinds[session.kind]}`
			: strings.appName;
	}, [session, timeLeft]);

	const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
	const logRows = todaysEvents(state.events, now);
	const workLocked = session?.kind === 'work';

	const start = (action: StartAction) => {
		setNow(action.at);
		// Cleared first: this START may complete an elapsed Session and raise a new banner.
		setBanner(null);
		const outcome = dispatch(action);
		if (outcome.type === 'confirm') setPending({ action, question: outcome.question });
	};

	const confirmPending = () => {
		if (!pending) return;
		setPending(null);
		const action = { ...pending.action, at: Date.now(), confirmed: true };
		if (action.type === 'START') start(action);
		else dispatch(action);
	};

	const clearLog = () => {
		const action: PendingAction = { type: 'CLEAR_LOG', at: Date.now() };
		const outcome = dispatch(action);
		if (outcome.type === 'confirm') setPending({ action, question: outcome.question });
	};

	const markDone = (id: string) => {
		const action: PendingAction = { type: 'MARK_DONE', at: Date.now(), id };
		const outcome = dispatch(action);
		if (outcome.type === 'confirm') setPending({ action, question: outcome.question });
	};

	const deleteTask = (id: string) => {
		const action: PendingAction = { type: 'DELETE', at: Date.now(), id };
		const outcome = dispatch(action);
		if (outcome.type === 'confirm') setPending({ action, question: outcome.question });
	};

	const restoreTask = (id: string) => dispatch({ type: 'RESTORE', id });

	const stop = () => {
		const at = Date.now();
		setNow(at);
		dispatch({ type: 'STOP', at });
	};

	const togglePause = () => {
		const at = Date.now();
		setNow(at);
		dispatch({ type: session?.pausedAt === null ? 'PAUSE' : 'RESUME', at });
	};

	const saveTask = (event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
		event.preventDefault();
		const outcome =
			editingTaskId !== null
				? dispatch({ type: 'EDIT_TASK', id: editingTaskId, name, estimate })
				: dispatch({
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
		setEditingTaskId(null);
		setName('');
		setEstimate('1');
		setError(null);
	};

	const editTask = (taskId: string) => {
		const task = stateRef.current.tasks.find((candidate) => candidate.id === taskId);
		if (!task) return;
		setEditingTaskId(task.id);
		setName(task.name);
		setEstimate(String(task.estimate));
		setError(null);
	};

	const updateTaskDrag = (event: PointerEvent) => {
		const taskId = draggedTaskId.current;
		const list = taskListRef.current;
		if (!taskId || !list) return;
		const fromIndex = stateRef.current.tasks.findIndex((task) => task.id === taskId);
		const items = Array.from(list.querySelectorAll('li'));
		if (fromIndex === -1 || items.length === 0) return;

		let toIndex = items.findIndex((item) => {
			const bounds = item.getBoundingClientRect();
			return event.clientY < bounds.top + bounds.height / 2;
		});
		if (toIndex === -1) toIndex = items.length - 1;
		else if (toIndex > fromIndex) toIndex -= 1;
		draggedToIndex.current = toIndex;
	};

	const finishTaskDrag = (event: PointerEvent, taskId: string) => {
		if (draggedTaskId.current !== taskId || draggedPointerId.current !== event.pointerId) return;
		updateTaskDrag(event);
		const toIndex = draggedToIndex.current;
		draggedTaskId.current = null;
		draggedPointerId.current = null;
		draggedToIndex.current = null;
		if (toIndex !== null) dispatch({ type: 'MOVE_TASK', id: taskId, toIndex });
	};

	const cancelTaskDrag = (taskId: string, pointerId: number) => {
		if (draggedTaskId.current !== taskId || draggedPointerId.current !== pointerId) return;
		draggedTaskId.current = null;
		draggedPointerId.current = null;
		draggedToIndex.current = null;
	};

	const cancelEdit = () => {
		setEditingTaskId(null);
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
				{session && (
					<p class="session-kind">
						{strings.timer.kinds[session.kind]}
						{session.pausedAt !== null && ` · ${strings.timer.paused}`}
					</p>
				)}
				{activeTask && (
					<p class="active-task">
						{activeTask.name}{' '}
						<span
							class={`task-count${activeTask.pomodoroCount > activeTask.estimate ? ' warning' : ''}`}
						>
							{activeTask.pomodoroCount}/{activeTask.estimate}
						</span>
					</p>
				)}
				<div class="timer-actions">
					{SESSION_KINDS.map((kind) => (
						<button
							key={kind}
							class={kind === 'work' ? 'primary' : undefined}
							type="button"
							onClick={() => start({ type: 'START', at: Date.now(), kind })}
							disabled={kind === 'work' && !activeTask}
							aria-describedby={kind === 'work' && !activeTask ? 'work-hint' : undefined}
						>
							{strings.timer.sessionButton(strings.timer.kinds[kind], DURATIONS[kind] / 60_000)}
						</button>
					))}
					{session && (
						<button type="button" onClick={togglePause}>
							{session.pausedAt === null ? strings.timer.pause : strings.timer.resume}
						</button>
					)}
					{session && (
						<button type="button" onClick={stop}>
							{strings.timer.stop}
						</button>
					)}
				</div>
				<div class="timer-settings">
					<label>
						<input
							type="checkbox"
							checked={state.soundEnabled}
							onChange={() => dispatch({ type: 'TOGGLE_SOUND' })}
						/>
						{strings.settings.sound}
					</label>
					<label>
						<input
							type="checkbox"
							checked={state.notificationsEnabled}
							disabled={state.notificationPermission === 'denied'}
							aria-describedby={
								state.notificationPermission === 'denied' ? 'notifications-hint' : undefined
							}
							onChange={() => dispatch({ type: 'TOGGLE_NOTIFICATIONS' })}
						/>
						{strings.settings.notifications}
					</label>
				</div>
				{state.notificationPermission === 'denied' && (
					<p id="notifications-hint" class="placeholder">
						{strings.settings.notificationsDenied}
					</p>
				)}
				{!activeTask && (
					<p id="work-hint" class="placeholder">
						{strings.timer.noActiveTask}
					</p>
				)}
				<p class="placeholder">{strings.timer.keepOpenNote}</p>
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
					<ul class="task-list" ref={taskListRef}>
						{state.tasks.map((task) => (
							<li key={task.id} data-task-id={task.id}>
								<button
									class={`task${task.id === state.activeTaskId ? ' active' : ''}`}
									type="button"
									aria-pressed={task.id === state.activeTaskId}
									disabled={workLocked && task.id !== state.activeTaskId}
									title={workLocked ? strings.tasks.activeTaskLocked : undefined}
									onClick={() => dispatch({ type: 'SELECT_TASK', at: Date.now(), id: task.id })}
								>
									<span>{task.name}</span>
									<span
										class={`task-count${task.pomodoroCount > task.estimate ? ' warning' : ''}`}
									>
										{task.pomodoroCount}/{task.estimate}
									</span>
								</button>
								<button
									class="task-handle"
									type="button"
									aria-label={`${strings.tasks.reorder}: ${task.name}`}
									onPointerDown={(event) => {
										if (event.button !== 0 || !event.isPrimary) return;
										event.preventDefault();
										draggedTaskId.current = task.id;
										draggedPointerId.current = event.pointerId;
										draggedToIndex.current = stateRef.current.tasks.findIndex(
											(candidate) => candidate.id === task.id,
										);
										event.currentTarget.setPointerCapture(event.pointerId);
									}}
									onPointerMove={updateTaskDrag}
									onPointerUp={(event) => finishTaskDrag(event, task.id)}
									onPointerCancel={(event) => cancelTaskDrag(task.id, event.pointerId)}
									onLostPointerCapture={(event) => cancelTaskDrag(task.id, event.pointerId)}
								>
									⋮⋮
								</button>
								<button
									type="button"
									aria-label={`${strings.tasks.edit}: ${task.name}`}
									onClick={() => editTask(task.id)}
								>
									{strings.tasks.edit}
								</button>
								<button type="button" onClick={() => markDone(task.id)}>
									{strings.tasks.markDone}
								</button>
								<button
									type="button"
									aria-label={`${strings.tasks.delete}: ${task.name}`}
									onClick={() => deleteTask(task.id)}
								>
									{strings.tasks.delete}
								</button>
							</li>
						))}
					</ul>
				)}
				<form class="task-form" onSubmit={saveTask} noValidate>
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
						{editingTaskId === null ? strings.tasks.add : strings.tasks.save}
					</button>
					{editingTaskId !== null && (
						<button type="button" onClick={cancelEdit}>
							{strings.tasks.cancel}
						</button>
					)}
				</form>
				{error && (
					<p class="form-error" role="alert">
						{error}
					</p>
				)}
				{state.doneTasks.length > 0 && (
					<details>
						<summary>{strings.tasks.doneHeading(state.doneTasks.length)}</summary>
						<ul class="task-list">
							{state.doneTasks.map((task) => (
								<li key={task.id}>
									<div class="task">
										<span>{task.name}</span>
										<span class="task-count">
											{task.pomodoroCount}/{task.estimate}
										</span>
									</div>
									<button type="button" onClick={() => restoreTask(task.id)}>
										{strings.tasks.restore}
									</button>
									<button
										type="button"
										aria-label={`${strings.tasks.delete}: ${task.name}`}
										onClick={() => deleteTask(task.id)}
									>
										{strings.tasks.delete}
									</button>
								</li>
							))}
						</ul>
					</details>
				)}
			</section>
			<section class="section" aria-labelledby="log-heading">
				<h2 id="log-heading">{strings.eventLog.heading}</h2>
				<button type="button" onClick={clearLog}>
					{strings.eventLog.clear}
				</button>
				{logRows.length === 0 ? (
					<p class="placeholder">{strings.eventLog.placeholder}</p>
				) : (
					<table class="event-log">
						<thead>
							<tr>
								<th>{strings.eventLog.columns.time}</th>
								<th>{strings.eventLog.columns.event}</th>
								<th>{strings.eventLog.columns.kind}</th>
								<th>{strings.eventLog.columns.task}</th>
								<th>{strings.eventLog.columns.duration}</th>
							</tr>
						</thead>
						<tbody>
							{logRows.map((event, index) => (
								<tr key={`${event.at}-${index}`}>
									<td>{formatClock(event.at)}</td>
									<td>{strings.eventLog.types[event.type]}</td>
									<td>{strings.timer.kinds[event.kind]}</td>
									<td>{event.taskName ?? ''}</td>
									<td>{event.durationMs === null ? '' : formatRemaining(event.durationMs)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
			{pending && (
				<ConfirmDialog
					question={pending.question}
					onConfirm={confirmPending}
					onCancel={() => setPending(null)}
				/>
			)}
			<ReloadPrompt />
		</main>
	);
}
