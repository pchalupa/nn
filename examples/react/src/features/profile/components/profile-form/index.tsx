import { CheckIcon } from "@phosphor-icons/react";
import { Button, Flex, Grid, Text } from "@radix-ui/themes";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useProfileForm } from "@/features/profile/use-profile-form";

import { ProfileFields } from "./profile-fields";

/** Renders the form that edits the current user name and its Cancel and Save changes actions, a sticky bottom bar on mobile. */
export const ProfileForm = () => {
	const { t } = useTranslation();
	const { form, nameError, handleCancel, handleSubmit } = useProfileForm();
	const formId = useId();

	return (
		<>
			<Flex asChild gridArea="form" direction="column" gap="4" mt={{ initial: "0", md: "7" }}>
				<form id={formId} noValidate onSubmit={handleSubmit}>
					<ProfileFields form={form} nameError={nameError} />
				</form>
			</Flex>
			<Grid
				gridArea="actions"
				columns={{ initial: "2", md: "auto auto" }}
				justify="end"
				align="center"
				alignSelf={{ initial: "end", md: "start" }}
				gap={{ initial: "2", md: "4" }}
				position={{ initial: "sticky", md: "static" }}
				bottom="0"
				mx={{ initial: "-4", md: "0" }}
				mt={{ initial: "0", md: "4" }}
				px={{ initial: "4", md: "0" }}
				py={{ initial: "3", md: "0" }}
				className="profile-actions"
			>
				<Button
					type="button"
					size={{ initial: "4", md: "2" }}
					variant="ghost"
					color="gray"
					className="bar-ghost-button"
					onClick={handleCancel}
				>
					<Text size="2">{t("cancel")}</Text>
				</Button>
				<Button type="submit" form={formId} size={{ initial: "4", md: "2" }}>
					<CheckIcon size={16} />
					<Text size="2">{t("saveChanges")}</Text>
				</Button>
			</Grid>
		</>
	);
};
