import { Box, Select } from "@radix-ui/themes";
import { language } from "example-schema";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { languageNames } from "../../i18n";
import { useQuery, useMutation } from "../../store";
import { Field } from "../field";

export const LanguageSelector = () => {
	const { i18n, t } = useTranslation();
	const selectedLanguage = useQuery((data) => data.language);
	const mutate = useMutation();

	// TBD: This should happen on the i18n.ts module level. Component like this should not be responsible for this. Current blocker is missing imperative API for store.
	useEffect(() => {
		if (i18n.language !== selectedLanguage) i18n.changeLanguage(selectedLanguage);
	}, [i18n, selectedLanguage]);

	const handleChange = (value: string) => {
		const nextLanguage = language.literals.find((code) => code === value);

		if (nextLanguage) {
			mutate((draft) => {
				draft.language = nextLanguage;
			});
		}
	};

	return (
		<Box px="4" py="2">
			<Field label={t("language")}>
				<Select.Root size="1" value={selectedLanguage} onValueChange={handleChange}>
					<Select.Trigger />
					<Select.Content>
						{language.literals.map((code) => (
							<Select.Item key={code} value={code}>
								{languageNames[code]}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</Field>
		</Box>
	);
};
