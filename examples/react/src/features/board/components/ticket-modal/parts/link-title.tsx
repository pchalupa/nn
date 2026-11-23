import { Link, Text } from "@radix-ui/themes";

import { isWebUrl } from "@/features/board/links";

interface LinkTitleProps {
	url: string;
	title: string;
}

/** Renders a link title that opens a web URL in a new tab, or plain text for any other URL. */
export const LinkTitle = ({ url, title }: LinkTitleProps) => {
	if (!isWebUrl(url)) {
		return (
			<Text size="2" truncate>
				{title}
			</Text>
		);
	}

	return (
		<Link size="2" color="gray" highContrast underline="hover" truncate href={url} target="_blank" rel="noreferrer">
			{title}
		</Link>
	);
};
