import { Flex, Grid, Heading } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

import { PersonAvatar } from "@/components/person-avatar";
import { useUser } from "@/features/authentication/authentication";
import { useQuery } from "@/store";

import { Stat } from "./parts/stat";

/** Shows the current user with the assigned count: beside the name from `md` up, in a divided row below it on mobile. */
export const Identity = () => {
	const { t } = useTranslation();
	const { id: userId, user } = useUser();
	const assignedCount = useQuery(
		(data) => data.boards.flatMap((board) => board.tickets).filter((ticket) => ticket.assignee === userId).length,
	);

	return (
		<Grid
			gridArea="identity"
			areas={{ initial: '"avatar name" "stats stats"', md: '"avatar name" "avatar stats"' }}
			columns="auto minmax(0, 1fr)"
			gapX="4"
			gapY={{ initial: "5", md: "1" }}
		>
			<Flex gridArea="avatar" alignSelf="center">
				<PersonAvatar user={user} size="5" />
			</Flex>
			<Flex gridArea="name" alignSelf={{ initial: "center", md: "end" }}>
				<Heading as="h2" size="6" truncate>
					{user?.name ?? t("unknownUser")}
				</Heading>
			</Flex>
			<Grid
				gridArea="stats"
				justify="start"
				alignSelf={{ initial: "stretch", md: "start" }}
				py={{ initial: "4", md: "0" }}
				className="profile-stats"
			>
				<Stat i18nKey="assignedCount" count={assignedCount} />
			</Grid>
		</Grid>
	);
};
