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
			accountNotOnDevice: "This account isn't on this device. Sign up to create it here.",
			addDescription: "Add a description",
			assignee: "Assignee",
			authFailed: "Couldn't verify your passkey. Try again.",
			backlog: "Backlog",
			board: "Board",
			create: "Create",
			description: "Description",
			done: "Done",
			email: "Email",
			inProgress: "In Progress",
			language: "Language",
			name: "Name",
			save: "Save",
			signIn: "Sign in with a passkey",
			signOut: "Sign out",
			signUp: "Sign up",
			status: "Status",
			tickets: "Tickets: {{count}}",
			title: "Title",
			todo: "To Do",
			unassigned: "Unassigned",
			welcome: "Welcome to DBug",
		},
	},
	cs: {
		translation: {
			accountNotOnDevice: "Tento účet na tomto zařízení není. Zaregistrujte se a vytvořte ho tady.",
			addDescription: "Přidat popis",
			assignee: "Řešitel",
			authFailed: "Přístupový klíč se nepodařilo ověřit. Zkuste to znovu.",
			backlog: "Zásobník",
			board: "Nástěnka",
			create: "Vytvořit",
			description: "Popis",
			done: "Hotovo",
			email: "E-mail",
			inProgress: "Probíhá",
			language: "Jazyk",
			name: "Jméno",
			save: "Uložit",
			signIn: "Přihlásit se přístupovým klíčem",
			signOut: "Odhlásit se",
			signUp: "Zaregistrovat se",
			status: "Stav",
			tickets: "Úkoly: {{count}}",
			title: "Název",
			todo: "K udělání",
			unassigned: "Nepřiřazeno",
			welcome: "Vítejte v DBug",
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
