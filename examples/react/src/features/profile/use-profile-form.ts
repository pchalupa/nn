import { useForm, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUser } from "@/features/authentication/authentication";
import { useMutation } from "@/store";

/** Reset options that replace every value, overriding the form's `keepDirtyValues` reset options. */
const replaceValues = { keepDirtyValues: false, keepFieldsRef: true };

/** Drives the form that edits the current user name: its field state, Save changes and Cancel. */
export function useProfileForm() {
	const { t } = useTranslation();
	const { id: userId, user } = useUser();
	const name = user?.name ?? "";
	const mutate = useMutation();
	const form = useForm({
		defaultValues: { name: "" },
		values: { name },
		resetOptions: { keepDirtyValues: true },
	});
	const { errors } = useFormState({ control: form.control, name: "name" });
	let nameError: string | undefined;

	if (errors.name) nameError = t("nameRequired");

	const handleCancel = () => form.reset({ name }, replaceValues);

	const handleSubmit = form.handleSubmit((values) => {
		const nextName = values.name.trim();

		mutate((draft) => {
			const account = draft.users.find((entry) => entry.id === userId);

			if (account) account.name = nextName;
		});
		form.reset({ name: nextName }, replaceValues);
	});

	return { form, nameError, handleCancel, handleSubmit };
}
