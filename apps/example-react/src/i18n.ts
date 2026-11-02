import { createInstance } from "i18next";

import type { Language, Status } from "./store";

export const languageNames: Record<Language, string> = {
	en: "English",
	cs: "Čeština",
};

export const statusLabels: Record<Status, string> = {
	todo: "todo",
	"in-progress": "inProgress",
	done: "done",
};

const defaultLanguage: Language = "en";

const resources = {
	en: {
		translation: {
			addDescription: "Add a description",
			assignee: "Assignee",
			backlog: "Backlog",
			board: "Board",
			cancel: "Cancel",
			description: "Description",
			done: "Done",
			email: "Email",
			inProgress: "In Progress",
			language: "Language",
			name: "Name",
			save: "Save",
			status: "Status",
			ticketNotFound: "Ticket not found",
			tickets: "Tickets: {{count}}",
			title: "Title",
			todo: "To Do",
			unassigned: "Unassigned",
		},
	},
	cs: {
		translation: {
			addDescription: "Přidat popis",
			assignee: "Řešitel",
			backlog: "Zásobník",
			board: "Nástěnka",
			cancel: "Zrušit",
			description: "Popis",
			done: "Hotovo",
			email: "E-mail",
			inProgress: "Probíhá",
			language: "Jazyk",
			name: "Jméno",
			save: "Uložit",
			status: "Stav",
			ticketNotFound: "Úkol nebyl nalezen",
			tickets: "Úkoly: {{count}}",
			title: "Název",
			todo: "K udělání",
			unassigned: "Nepřiřazeno",
		},
	},
};

export const i18n = createInstance();

i18n.init({
	resources,
	lng: defaultLanguage,
	fallbackLng: defaultLanguage,
	interpolation: { escapeValue: false },
});
