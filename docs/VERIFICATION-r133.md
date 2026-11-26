# WrapItfUp r133 group wiring view

## Using the view

1. Open a project and select **Top → Group 接線圖**.
2. Open **勾選顯示的 Group**. Search for an instance or group. For a focused slide, clear the checkboxes, then select both endpoints of the connections you want.
3. Download **SVG** for a scalable slide image or **PNG** for a bitmap. Both exports use the active filters.

The view reads the electrical endpoints and the hierarchical group path from each module sheet. An instance ID and group path identify each endpoint, including when the same module occurs multiple times. Top I/O uses its own groups. A pair combines traffic in either direction and counts each distinct net once. A fanout net can appear on multiple pairs. Ungrouped and unconnected endpoints are omitted. A constant alone has no group at the other end. Straight net aliases with identical declared ranges are followed. Logic expressions and sliced assigns are outside this direct-connect view. Filtering is stored in the project workspace.

## Verification

- The automated suite exercises bundling, fanout, reverse traffic, ungrouped endpoints, removal of a formerly assigned group, intra-group loops, bit selections and concatenations, aliases, constants, label escaping, the panel's empty state and filtered SVG output.
- A local seven-instance design independently reconstructed from module sheet groups, port directions and net bindings yielded 66 connected instance groups, 46 pairs and 293 distinct nets. All 323 net-to-pair memberships and the direction of each pair matched. Visible wire segments on the full group diagram had zero positive-length collinear overlaps. Perpendicular crossings may occur.
- Filtering to a pair carrying 11 nets produced one line with arrows in both directions. The SVG was rasterized and inspected. The source project, Verilog export and org export matched byte-for-byte before and after drawing and filtering.
- All 95 automated tests, the offline build and the public-content audit passed via `npm run release:check`. The browser download click and browser PNG encoder still need a live browser check. External gen_top, ASIC/FPGA compilation and simulation were not run for this presentation feature.
- The group diagram has a separate layout. The existing full pin diagram can still contain overlapping sections, including near its lower edge.

## Updating a source checkout

For r130, r131 or r132, extract the cumulative update ZIP at the repository root, preserving its directory structure. Run `npm run release:check` to build the site and standalone HTML. For offline use, open **WrapItfUp-r133-offline.html** directly.
