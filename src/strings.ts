// All user-facing Polish text lives here, ready for i18n later.
export const strings = {
	appName: 'Pomodorox',
	timer: {
		heading: 'Timer',
		sessionButton: (kind: string, minutes: number) => `${kind} (${minutes})`,
		stop: 'Stop',
		pause: 'Pauza',
		resume: 'Wznów',
		paused: 'Wstrzymano',
		alreadyPaused: 'Sesja jest już wstrzymana.',
		notPaused: 'Sesja nie jest wstrzymana.',
		kinds: {
			work: 'Praca',
			shortBreak: 'Krótka przerwa',
			longBreak: 'Długa przerwa',
		},
		dismiss: 'Zamknij',
		noActiveTask: 'Najpierw wybierz zadanie.',
		confirmAbandon: 'Porzucić bieżącą sesję?',
		noSession: 'Nie ma sesji do zatrzymania.',
		workCompleted: (taskName: string, pomodoroCount: number, estimate: number) =>
			`Praca zakończona: ${taskName} (${pomodoroCount}/${estimate}). Czas na przerwę.`,
		endedWhileClosed: (summary: string) => `Sesja zakończyła się, gdy aplikacja była zamknięta. ${summary}`,
		keepOpenNote:
			'Aplikacja musi pozostać otwarta (także w tle), aby powiadomienia docierały na czas.',
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
	confirm: {
		yes: 'Tak',
		cancel: 'Anuluj',
	},
	pwa: {
		offlineReady: 'Aplikacja jest gotowa do pracy offline.',
		needRefresh: 'Dostępna jest nowa wersja.',
		reload: 'Odśwież',
		close: 'Zamknij',
	},
} as const;
