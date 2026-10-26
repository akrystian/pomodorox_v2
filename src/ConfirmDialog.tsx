import { useEffect, useRef } from 'preact/hooks';
import { strings } from './strings';

type Props = {
	question: string;
	onConfirm: () => void;
	onCancel: () => void;
};

// Shown for a `confirm` outcome; mounted only while a question is pending.
export function ConfirmDialog({ question, onConfirm, onCancel }: Props) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	return (
		<dialog
			ref={ref}
			class="confirm-dialog"
			aria-labelledby="confirm-question"
			onCancel={(event) => {
				event.preventDefault();
				onCancel();
			}}
		>
			<p id="confirm-question">{question}</p>
			<div class="confirm-actions">
				<button type="button" onClick={onCancel}>
					{strings.confirm.cancel}
				</button>
				<button class="primary" type="button" onClick={onConfirm}>
					{strings.confirm.yes}
				</button>
			</div>
		</dialog>
	);
}
