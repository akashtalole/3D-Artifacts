# PQC Road Works

An animated, step-by-step construction of a jointed plain concrete pavement (JPCP) with a pavement-quality-concrete (PQC) slab. It follows the sequence and typical requirements of IRC:15, IRC:58 and MoRTH Section 600.

- **Ten stages on one timeline:**
  1. Subgrade
  2. Granular sub-base (drainage layer)
  3. Dry lean concrete
  4. Separation membrane
  5. Stringlines
  6. Slip-form paving with dowel-bar and tie-bar inserters, then texturing and curing compound
  7. Saw-cut joints
  8. Wet curing
  9. Joint sealing
  10. Checks and opening
- **Machines:**
  - grader, vibratory and tandem rollers, tippers, DLC paver;
  - batching plant, dumpers, placer-spreader, slip-form paver (DBI + TBI), texture-curing machine;
  - concrete saws, water tanker;
  - shoulder paver, crews and traffic.
- **The road:** 180 m of two-lane carriageway (7.5 m), 300 mm M40 slab, contraction joints every 4.5 m (39 joints), 975 dowels and 300 tie bars. X-ray mode shows the steel inside the slab.
- **Site clock:** day and time for each stage. It shows each joint's age when sawn against the 4–24 h window, and the concrete's age at opening (28 days).
- **Panels:**
  - **Stage:** requirements with code references, plant, and quality checks.
  - **Drawings:** scaled to the slab thickness (cross-section, contraction joint, longitudinal joint, joint layout).
  - **Calculator:** quantities, dowels and tie bars, cement, concrete demand, dumpers and paving days.
  - **QC log:** filled in as the work passes.
  - **Codes:** the list of codes followed.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#stage=pav&p=0.4
```

Values are typical of the codes cited; the contract specification and the current editions govern. `src/kit.js` and `src/earthmovers.js` are shared with `projects/heavy-machinery`.

Docs: `docs/projects/pqc-road/`.
