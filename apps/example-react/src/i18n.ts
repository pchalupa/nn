import { createInstance } from "i18next";

export const languages = {
	en: "English",
	cs: "Čeština",
};

export type Language = keyof typeof languages;

export const defaultLanguage: Language = "en";

export const isLanguage = (value: unknown): value is Language => typeof value === "string" && value in languages;

const resources = {
	en: {
		translation: {
			backlog: "Backlog",
			board: "Board",
			done: "Done",
			inProgress: "In Progress",
			language: "Language",
			tickets: "Tickets: {{count}}",
			todo: "To Do",
		},
	},
	cs: {
		translation: {
			backlog: "Zásobník",
			board: "Nástěnka",
			done: "Hotovo",
			inProgress: "Probíhá",
			language: "Jazyk",
			tickets: "Úkoly: {{count}}",
			todo: "K udělání",
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
