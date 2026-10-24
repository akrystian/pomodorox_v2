// All user-facing Polish text lives here, ready for i18n later.
export const strings = {
	appName: 'Pomodorox',
	timer: {
		heading: 'Timer',
		placeholder: 'Tu pojawi się timer z przyciskami Praca, Krótka przerwa i Długa przerwa.',
	},
	tasks: {
		heading: 'Zadania',
		placeholder: 'Tu pojawi się lista zadań.',
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
