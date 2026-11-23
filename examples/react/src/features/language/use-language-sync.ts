import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@/store";

/** Applies the language stored in the store to the interface. */
export function useLanguageSync(): void {
	const { i18n } = useTranslation();
	const language = useQuery((data) => data.language);

	useEffect(() => {
		if (i18n.language !== language) i18n.changeLanguage(language);
	}, [i18n, language]);
}
