import { Collection } from "./Collection";

export function map<Data extends Record<string, unknown>>(data: Data) {
	return data;
}

export function string(data = ""): string {
	return data;
}

export function collection<Type extends { id: string }>(): (data: Type[]) => Collection<Type> {
	return (data: Type[]) => new Collection<Type>(data);
}
