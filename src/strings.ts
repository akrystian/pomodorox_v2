// All user-facing Polish text lives here, ready for i18n later.
export const strings = {
	appName: 'Pomodorox',
	timer: {
		heading: 'Timer',
		startWork: 'Praca (25)',
		kinds: {
			work: 'Praca',
			shortBreak: 'Krótka przerwa',
			longBreak: 'Długa przerwa',
		},
		dismiss: 'Zamknij',
		noActiveTask: 'Najpierw wybierz zadanie.',
		sessionRunning: 'Sesja już trwa.',
		workCompleted: (taskName: string, pomodoroCount: number, estimate: number) =>
			`Praca zakończona: ${taskName} (${pomodoroCount}/${estimate}). Czas na przerwę.`,
		breakCompleted: 'Przerwa zakończona. Wracamy do pracy?',
	},
	tasks: {
		heading: 'Zadania',
		emptyHint: 'Dodaj zadanie, aby zacząć',
		invalidName: 'Zadanie musi mieć nazwę.',
		unknownTask: 'Nie ma takiego zadania.',
		activeTaskLocked: 'W trakcie pracy nie można zmienić zadania.',
		invalidEstimate: 'Estimate musi być liczbą całkowitą ≥ 1.',
		nameLabel: 'Nazwa zadania',
		estimateLabel: 'Estimate',
		add: 'Dodaj',
	},
	eventLog: {
		heading: 'Dziennik (dziś)',
		placeholder: 'Tu pojawią się dzisiejsze zdarzenia.',
	},
	pwa: {
		offlineReady: 'Aplikacja jest gotowa do pracy offline.',
		needRefresh: 'Dostępna jest nowa wersja.',
		reload: 'Odśwież',
		close: 'Zamknij',
	},
} as const;
