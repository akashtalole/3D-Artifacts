# Turbofan Ops

Operate a generic high-bypass turbofan (≈130 kN / 29,000 lbf class) in 3D.

- **Engine:**
  - Quarter cutaway or X-ray view.
  - 18 swept fan blades, outlet guide vanes, a 3-stage booster and a 10-stage HP compressor.
  - An annular combustor with 18 fuel nozzles and 2 igniters, a 2-stage HP turbine and a 7-stage LP turbine.
  - Concentric LP and HP spools, the accessory gearbox and air starter.
  - A cascade thrust reverser with a translating sleeve and blocker doors.
  - An exploded view and airflow particles coloured by gas temperature.
- **Operations:**
  - APU bleed, ENG MODE (CRANK / NORM / IGN-START) and ENG MASTER.
  - A FADEC auto-start: starter valve, igniter at 16% N2, fuel at 22%, light-off, starter cut-out at 50%, idle.
  - A thrust lever with IDLE / CL / FLX / TOGA detents and reverse on the ground.
  - Continuous ignition, the fire handle and two extinguisher agents.
  - Flight conditions from the ground to FL350, and OAT from ISA−30 to ISA+40.
- **Model:**
  - Spool dynamics driven by fuel flow and starter torque.
  - FADEC acceleration and deceleration schedules, an EGT limiter and flat rating.
  - A quasi-steady Brayton cycle giving station temperatures and pressures, airflow, bypass ratio, OPR, jet velocities, thrust and TSFC.
  - Take-off at sea level: about 120 kN, OPR ≈ 40, BPR ≈ 9, EGT ≈ 970 °C. Cruise at FL350: TSFC ≈ 0.55 lb/lbf·h.
- **Training:** hot start, hung start, no light-off, compressor stall, bird strike, engine fire, oil leak (leading to bearing seizure) and flameout with relight.
  - EICAS-style gauges and ECAM-style alerts with procedure steps.
  - A start checklist that ticks itself off, and an event log.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#run=1&tla=1&view=comb
```

Illustrative training model; not any certified engine's data or procedures.

Docs: `docs/projects/turbofan-ops/`.
