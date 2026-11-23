import { type ChangeEvent, type KeyboardEvent, useState } from "react";

/** Holds the typed label text, adding it on Enter unless it is blank or already on the ticket. */
export function useLabelText(labels: string[], onAdd: (label: string) => void) {
	const [text, setText] = useState("");

	const add = (name: string) => {
		const label = name.trim();

		if (label !== "" && !labels.includes(label)) onAdd(label);
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => setText(event.target.value);

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter" || event.metaKey || event.ctrlKey) return;

		event.preventDefault();
		add(text);
		setText("");
	};

	return { text, setText, add, handleChange, handleKeyDown };
}
