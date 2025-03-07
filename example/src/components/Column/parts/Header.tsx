import { Button } from "../../Button";

interface HeaderProps {
	title: string;
	onAddClick?: () => void;
}

export const Header = ({ title, onAddClick: handleOnClick }: HeaderProps) => (
	<div className="flex flex-row items-center justify-between">
		<h3 className="text-sm uppercase">{title}</h3>
		<Button text="+" onClick={handleOnClick} />
	</div>
);
