import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { languageNames } from "../../i18n";
import { language, useRead, useUpdate } from "../../store";

export const LanguageSelector = () => {
	const { i18n, t } = useTranslation();
	const selectedLanguage = useRead((data) => data.language);
	const updateStore = useUpdate();

	// TBD: This should happen on the i18n.ts module level. Component like this should not be responsible for this. Current blocker is missing imperative API for store.
	useEffect(() => {
		if (i18n.language !== selectedLanguage) i18n.changeLanguage(selectedLanguage);
	}, [i18n, selectedLanguage]);

	const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const nextLanguage = language.literals.find((code) => code === event.target.value);

		if (nextLanguage) {
			updateStore((draft) => {
				draft.language = nextLanguage;
			});
		}
	};

	return (
		<label className="flex flex-col gap-y-1 px-4 py-2 text-xs text-zinc-600">
			{t("language")}
			<select
				value={selectedLanguage}
				onChange={handleChange}
				className="rounded bg-zinc-700 px-2 py-1 text-sm text-zinc-200"
				aria-label={t("language")}
			>
				{language.literals.map((code) => (
					<option key={code} value={code}>
						{languageNames[code]}
					</option>
				))}
			</select>
		</label>
	);
};
