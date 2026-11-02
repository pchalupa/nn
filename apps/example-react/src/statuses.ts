// TODO: will be handled by schema.enum()

export type Status = "todo" | "in-progress" | "done";

export const statuses: readonly Status[] = ["todo", "in-progress", "done"];

export const statusLabels: Record<Status, string> = {
	todo: "todo",
	"in-progress": "inProgress",
	done: "done",
};

export const isStatus = (value: unknown): value is Status => statuses.some((status) => status === value);
