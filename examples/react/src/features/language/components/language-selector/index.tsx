import { Select } from "@radix-ui/themes";
import { language } from "example-schema";
import { useTranslation } from "react-i18next";

import { languageNames } from "../../../../i18n";
import { useQuery, useMutation } from "../../../../store";
import { Field } from "../../../../components/field";

/** Renders the language field that stores the chosen interface language. */
export const LanguageSelector = () => {
	const { t } = useTranslation();
	const selectedLanguage = useQuery((data) => data.language);
	const mutate = useMutation();

	const handleChange = (value: string) => {
		const nextLanguage = language.literals.find((code) => code === value);

		if (nextLanguage) {
			mutate((draft) => {
				draft.language = nextLanguage;
			});
		}
	};

	return (
		<Select.Root size="2" value={selectedLanguage} onValueChange={handleChange}>
			<Field label={t("language")}>
				<Select.Trigger />
			</Field>
			<Select.Content>
				{language.literals.map((code) => (
					<Select.Item key={code} value={code}>
						{languageNames[code]}
					</Select.Item>
				))}
			</Select.Content>
		</Select.Root>
	);
};
