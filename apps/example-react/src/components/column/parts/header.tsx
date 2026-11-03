interface HeaderProps {
	title: string;
}

export const Header = ({ title }: HeaderProps) => (
	<div className="flex flex-row items-center justify-between">
		<h3 className="text-sm font-medium text-zinc-200 uppercase">{title}</h3>
	</div>
);
