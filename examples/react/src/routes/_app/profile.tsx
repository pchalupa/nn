import { ListIcon, UserIcon } from "@phosphor-icons/react";
import { Flex, Grid } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MobileHeader } from "@/components/mobile-header";
import { HeaderButton } from "@/components/mobile-header/header-button";
import { PageHeader } from "@/components/page-header";
import { Drawer } from "@/features/navigation/components/drawer";
import { Identity } from "@/features/profile/components/identity";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { SignOutButton } from "@/features/profile/components/sign-out-button";

const Profile = () => {
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);

	const handleOpenMenu = () => setMenuOpen(true);

	return (
		<>
			<MobileHeader
				action={
					<HeaderButton label={t("openMenu")} onClick={handleOpenMenu}>
						<ListIcon size={20} />
					</HeaderButton>
				}
				title={t("profile")}
			/>
			<PageHeader icon={<UserIcon size={16} color="var(--gray-a11)" />} title={t("profile")} />
			<Grid
				areas={{
					initial: '"identity" "form" "sign-out" "actions"',
					md: '"identity identity sign-out" "form . ." "actions . ."',
				}}
				columns={{ initial: "1", md: "560px 1fr auto" }}
				rows={{ initial: "auto auto auto 1fr", md: "auto" }}
				alignContent="start"
				gapX="4"
				gapY={{ initial: "5", md: "0" }}
				px={{ initial: "4", md: "8" }}
				pt={{ initial: "4", md: "7" }}
				pb={{ initial: "0", md: "7" }}
				flexGrow="1"
				minHeight="0"
				overflowY="auto"
			>
				<Identity />
				<ProfileForm />
				<Flex gridArea="sign-out" direction="column" alignSelf={{ initial: "stretch", md: "center" }}>
					<SignOutButton />
				</Flex>
			</Grid>
			<Drawer open={menuOpen} onOpenChange={setMenuOpen} />
		</>
	);
};

export const Route = createFileRoute("/_app/profile")({
	component: Profile,
});
