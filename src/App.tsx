import { strings } from './strings';
import { ReloadPrompt } from './ReloadPrompt';

export function App() {
	return (
		<main class="app">
			<section class="section" aria-labelledby="timer-heading">
				<h2 id="timer-heading">{strings.timer.heading}</h2>
				<p class="placeholder">{strings.timer.placeholder}</p>
			</section>
			<section class="section" aria-labelledby="tasks-heading">
				<h2 id="tasks-heading">{strings.tasks.heading}</h2>
				<p class="placeholder">{strings.tasks.placeholder}</p>
			</section>
			<section class="section" aria-labelledby="log-heading">
				<h2 id="log-heading">{strings.eventLog.heading}</h2>
				<p class="placeholder">{strings.eventLog.placeholder}</p>
			</section>
			<ReloadPrompt />
		</main>
	);
}
