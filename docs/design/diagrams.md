<!-- cspell:words goodstate -->

# Diagrams

Mermaid diagrams for READMEs and docs. Colors and type follow [`VISUAL_GUIDELINES.md`](VISUAL_GUIDELINES.md).

## Rules

- A replica runs a store and merges. Browser, Node.js, and API-route replicas are peers, so they all get the same shape.
- A relay forwards entries and never merges. `example-server` is a relay. Draw it with the hexagon shape (`{{ }}`), never as a replica.
- Persistence (IndexedDB, memory, Redis) is a cylinder (`[( )]`).
- Group replicas by environment in a `subgraph` labeled `BROWSER · DEVICE 1`.
- Label every link with its transport: `SSE`, `BroadcastChannel`, `IndexDbSync`.
- Draw offline on the link, not the node. A disconnected replica keeps its normal outline, and its link turns dashed. The link is down, the state is intact.
- Status words are `SyncState` values (`connected`, `disconnected`), with the glyph from the guide.
- Mars Orange on at most one kind of focal element.

## Mermaid for GitHub

Only strokes are styled. Fills stay transparent and text inherits GitHub's own theme, so the diagram reads in light and dark mode. Mars Orange `#D9621E` and Bronze `#B48A55` both keep at least 3:1 against GitHub's light (`#FFFFFF`) and dark (`#0D1117`) canvases. Don't depend on init directives or `themeVariables` in a README, since GitHub's renderer changes.

```mermaid
flowchart LR
	subgraph device1["BROWSER · DEVICE 1"]
		tab1["Replica · tab 1<br/>example-react"]
		tab2["Replica · tab 2<br/>example-react"]
		idb1[("IndexedDB")]
	end

	relay{{"Relay · example-server<br/>stores latest entries, no merge"}}
	node1["Replica · Node.js<br/>example-node"]

	subgraph device2["BROWSER · DEVICE 2"]
		tab3["Replica · tab 1<br/>◐ disconnected"]
		idb2[("IndexedDB")]
	end

	tab1 <-->|BroadcastChannel| tab2
	tab1 <-->|IndexDbSync| idb1
	tab2 <-->|IndexDbSync| idb1
	tab2 <-->|SSE| relay
	relay <-->|SSE| node1
	relay -.-|SSE · down| tab3
	tab3 <-->|IndexDbSync| idb2

	classDef replica fill:transparent,stroke:#D9621E,stroke-width:2px
	classDef relay fill:transparent,stroke:#B48A55,stroke-width:2px
	classDef store fill:transparent,stroke:#B48A55,stroke-width:1px
	class tab1,tab2,tab3,node1 replica
	class relay relay
	class idb1,idb2 store
	style device1 fill:transparent,stroke:#B48A55,stroke-width:1px
	style device2 fill:transparent,stroke:#B48A55,stroke-width:1px
	linkStyle 5 stroke:#B48A55,stroke-width:2px,stroke-dasharray:5 4
```

`linkStyle 5` targets the sixth link, counted from zero in source order. Update the index whenever you add or reorder links.

## Mermaid on a site you control

Render with the `base` theme and pass the tokens as `themeVariables`. Re-render diagrams when the theme changes, because Mermaid bakes colors into the SVG.

```js
const light = {
	background: "#FAF0DE",
	primaryColor: "#FFFAF0",
	primaryTextColor: "#1C130C",
	primaryBorderColor: "#1C130C",
	secondaryColor: "#EEDDC2",
	tertiaryColor: "#FAF0DE",
	lineColor: "#1C130C",
	clusterBkg: "#FAF0DE",
	clusterBorder: "#6B4A34",
	edgeLabelBackground: "#FAF0DE",
	fontFamily: "IBM Plex Sans, system-ui, sans-serif",
	fontSize: "14px",
};

const dark = {
	...light,
	background: "#1C130C",
	primaryColor: "#241810",
	primaryTextColor: "#FAF0DE",
	primaryBorderColor: "#B48A55",
	secondaryColor: "#140D08",
	tertiaryColor: "#1C130C",
	lineColor: "#FAF0DEB3",
	clusterBkg: "#1C130C",
	clusterBorder: "#B48A55",
	edgeLabelBackground: "#1C130C",
};

mermaid.initialize({
	startOnLoad: false,
	theme: "base",
	themeVariables: document.documentElement.dataset.theme === "dark" ? dark : light,
	flowchart: { curve: "linear" },
});
```

## Sync engine lifecycle

A state diagram that uses the real `SyncState` values from `@goodstate/sync-engine`. Keep it in plain Mermaid so it renders the same everywhere.

```mermaid
stateDiagram-v2
	direction LR
	[*] --> idle
	idle --> connecting: connect()
	connecting --> connected: open and pull succeed
	connecting --> disconnected: open or pull fails
	connected --> disconnected: connection drops
	connected --> connecting: reopen
	disconnected --> connecting: retry()
	idle --> disposed: dispose()
	connected --> disposed: dispose()
	disconnected --> disposed: dispose()
	disposed --> [*]
```

`connecting` can also move to `disposed`. It is left out to keep the diagram readable, which is the kind of simplification to call out in prose.
