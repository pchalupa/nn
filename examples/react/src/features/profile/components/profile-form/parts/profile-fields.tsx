import { Flex, Heading, Text, TextField } from "@radix-ui/themes";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Field } from "@/components/field";
import { LanguageSelector } from "@/features/language/components/language-selector";

interface ProfileFieldsProps {
	form: UseFormReturn<{ name: string }>;
	nameError?: string;
}

/** Renders the Profile section heading with the name and language fields. */
export const ProfileFields = ({ form, nameError }: ProfileFieldsProps) => {
	const { t } = useTranslation();

	return (
		<>
			<Flex direction="column" gap="1">
				<Heading as="h2" size="2">
					{t("profile")}
				</Heading>
				<Text as="p" size="2" color="gray">
					{t("profileBody")}
				</Text>
			</Flex>
			<Field label={t("name")} hint={t("profileNameHint")} error={nameError}>
				<TextField.Root autoComplete="name" {...form.register("name", { validate: (value) => value.trim() !== "" })} />
			</Field>
			<LanguageSelector />
		</>
	);
};
