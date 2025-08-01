import { Collection } from "./Collection";

export function collection<Type extends { id: string }>(): (data: Type[]) => Collection<Type> {
	return (data: Type[]) => new Collection<Type>(data);
}
