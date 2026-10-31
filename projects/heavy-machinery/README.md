# Earthmovers

A 3D portfolio of heavy construction equipment: eight machine classes you can inspect, operate, configure, price, compare and put to work.

- **Machines:** backhoe loader, 20 t hydraulic excavator, wheel loader, crawler dozer, 90 t rigid haul truck, motor grader, telescopic handler and skid steer loader.
  - Each is built in code from booms, buckets, tracks, tyres and cabs.
  - Named joints move the machine, and hydraulic rams follow them with their rods sliding in and out of the barrels.
  - Each has attachments (buckets, breakers, augers, forks, a sweeper, a jib) and hotspots.
- **Showroom:**
  - Turntable, camera presets including a cab view, and overall dimensions.
  - A working-range chart computed from the model's own linkage.
- **Operate:** sliders and keyboard controls for every joint (the excavator uses the ISO pattern), a demo cycle, and tool-tip reach and height read-outs.
- **Configure:** fleet livery, attachments and options, a quote with GST, finance EMI and owning-and-operating cost per hour, and a downloadable quote.
- **Compare:** weight, power, price, fuel and power-to-weight across all eight machines.
- **Fleet planner:** match a loading machine to haulers, then estimate passes per load, trucks needed, production, days, cost per m³ and fuel for a cut-and-haul job.
- **Sandbox:** drive a machine and dig.
  - Buckets cut a deformable heightfield and carry soil, and dumping fills the parked haul truck or piles the soil on the ground.
  - Dozer and grader blades push and windrow the material.
- **Job site:** all eight machines at work on looping, scripted cycles.
  - The excavator loads two haul trucks in turn, and the trucks run a haul road to a dump that a dozer spreads.
  - The wheel loader feeds a crusher hopper, the grader trims the access road and the backhoe trenches.
  - The telehandler lifts pallets onto a building and a skid steer cleans up.
  - Live counters, time controls, and a follow camera for any machine.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#m=excavator&mode=sand
```

The machines are generic and modelled on typical machines of each class. Earthmovers is not affiliated with any manufacturer, and its figures and prices are illustrative.

Docs: `docs/projects/heavy-machinery/`.
