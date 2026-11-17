import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { RGA } from "@nn/entities/kinds/rga";

import { ListTracker } from "./list-tracker";
import { MapTracker } from "./map-tracker";
import { copy, type Tracker } from "./tracker";

export function track(
	entity: Entity,
	parent: Tracker | undefined,
	trackers: Map<Entity, Tracker> = parent?.trackers ?? new Map(),
): unknown {
	if (RGA.is(entity)) return new ListTracker(entity, [], parent, trackers, track).proxy;

	if (LWWMap.is(entity)) return new MapTracker(entity, {}, parent, trackers, track).proxy;

	return copy(entity.current);
}
