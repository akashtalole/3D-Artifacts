# Logistics Twin

A 3D digital twin of an e-commerce fulfilment centre near Mumbai. A discrete-time simulation runs the whole flow:

1. **Inbound:** supplier trucks reverse into the inbound doors and are unloaded, and reach trucks put pallets away into 910 positions of selective racking.
2. **Picking:** customer orders arrive by hour of day. A fleet of AMR robots picks them from 480 pick faces, with zone pickers loading the totes.
3. **Packing:** pack stations pack the orders.
4. **Sortation:** a sorter diverts parcels to eight destination lanes.
5. **Outbound:** line-haul trailers are wave-loaded and depart on schedule, or early when they are full.

Things you can watch and change:

- **Live KPIs:** shipped per hour, order cycle time, on-time %, fill rate, dock-to-stock, robot travel, cost per order (₹, illustrative) and resource utilisation.
- **Bottleneck detection:** a one-click fix for each bottleneck it finds.
- **Scenarios:** normal day, festive sale peak, scaled-up peak, dock disruption and random slotting.
- **Live controls:** demand, AMR count, single or batch picking, ABC or random slotting, pack stations, reach trucks, inbound rate and doors, and the SLA.
- **Inspection:** click robots, reach trucks, trucks and rack faces to inspect or follow them. A traffic heatmap shows robot and forklift travel.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#s=festive&speed=60
```

The facility, carriers, SKUs and costs are invented for illustration.

Docs: `docs/projects/logistics-twin/`.
