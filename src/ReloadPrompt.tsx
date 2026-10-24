import { useRegisterSW } from 'virtual:pwa-register/preact';
import { strings } from './strings';

export function ReloadPrompt() {
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW();

	if (!offlineReady && !needRefresh) return null;

	const close = () => {
		setOfflineReady(false);
		setNeedRefresh(false);
	};

	return (
		<div class="reload-prompt" role="status">
			<span>{needRefresh ? strings.pwa.needRefresh : strings.pwa.offlineReady}</span>
			{needRefresh && (
				<button class="primary" onClick={() => updateServiceWorker(true)}>
					{strings.pwa.reload}
				</button>
			)}
			<button onClick={close}>{strings.pwa.close}</button>
		</div>
	);
}
