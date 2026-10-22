/**
 * Construction stages of a jointed plain concrete pavement (JPCP) with a PQC slab,
 * following the sequence of IRC:15 (Code of Practice for Construction of Jointed
 * Plain Concrete Pavements), IRC:58 (design of rigid pavements) and MoRTH
 * Specifications for Road and Bridge Works, Sections 300, 400 and 600.
 * Values are typical; the contract specification and the current editions govern.
 */
export const ROAD = {
  L: 180,                 // m of road built in the animation (Ch 0+000 to 0+180)
  width: 7.5,             // two-lane carriageway paved in one pass
  pqc: 0.30, dlc: 0.15, gsb: 0.15, sub: 0.50,
  jointSpacing: 4.5,      // m, transverse contraction joints
  dowelSpacing: 0.30, tieSpacing: 0.60,
};

export const STAGES = [
  {
    id: 'sub', name: 'Subgrade', day: 'Days 1–4', dur: 24,
    what: 'The top 500 mm of the embankment is built as the subgrade: spread in layers by the grader and compacted by a vibratory roller to the line, level and cross-fall of the road.',
    req: [['Thickness', '500 mm, laid in layers of ≤200 mm compacted thickness', 'MoRTH 305'], ['Compaction', '≥97% of maximum dry density (heavy compaction)', 'MoRTH 305'], ['Strength', 'Design CBR, typically ≥8% (soaked)', 'IRC:58'], ['Level', '±20 mm of the design level', 'MoRTH 902']],
    machines: ['Motor grader', 'Vibratory roller', 'Water tanker'],
    qc: ['Field density by sand replacement or core cutter', 'Moisture content at compaction near OMC', 'Level and cross-fall at 10 m intervals'],
  },
  {
    id: 'gsb', name: 'Granular sub-base (drainage layer)', day: 'Days 5–7', dur: 24,
    what: 'Tippers place graded aggregate, the grader spreads it to a uniform loose depth and the roller compacts it into a 150 mm free-draining layer that keeps water out of the pavement.',
    req: [['Thickness', '150 mm compacted (as per design)', 'IRC:58'], ['Material', 'Graded aggregate with low fines, permeable', 'MoRTH 401'], ['Compaction', '≥98% of maximum dry density', 'MoRTH 401'], ['Level', '±10 mm of the design level', 'MoRTH 902']],
    machines: ['Tippers', 'Motor grader', 'Vibratory roller'],
    qc: ['Gradation and plasticity of the GSB material', 'Field density ≥98% MDD', 'Permeability of the drainage layer'],
  },
  {
    id: 'dlc', name: 'Dry lean concrete (DLC)', day: 'Days 8–15', dur: 22,
    what: 'A paver lays 150 mm of dry lean concrete, rolled immediately by a tandem roller and cured for 7 days. The DLC is wider than the PQC so the paver tracks run on it.',
    req: [['Thickness', '150 mm', 'IRC:58'], ['Cement', '≥150 kg/m³ (≥200 kg/m³ cement + fly ash); aggregate : cement ≤ 15 : 1', 'MoRTH 601'], ['Strength', '7-day compressive strength ≥10 MPa average, no result below 7.5 MPa', 'MoRTH 601'], ['Compaction', '≥98% of the dry density of the trial length', 'MoRTH 601'], ['Curing', '7 days, then cleaned before PQC', 'MoRTH 601']],
    machines: ['Tipper', 'DLC paver', 'Tandem roller'],
    qc: ['Cubes for 7-day strength', 'Density by core or sand replacement', 'Surface level: +6 / −10 mm', 'Thickness by cores'],
  },
  {
    id: 'mem', name: 'Separation membrane', day: 'Day 16', dur: 12,
    what: 'A polythene sheet is laid on the clean DLC so the PQC slab can expand, contract and curl freely without bonding to the DLC, which would cause reflective cracking.',
    req: [['Membrane', '125 micron polythene sheet (or a wax-based bond breaker)', 'IRC:15'], ['Laps', '≥300 mm, no wrinkles or tears', 'IRC:15'], ['Surface', 'DLC cleaned of loose material before laying', 'IRC:15']],
    machines: ['Laying crew'],
    qc: ['Sheet thickness and integrity', 'Laps and anchorage against wind'],
  },
  {
    id: 'str', name: 'Stringlines', day: 'Day 16', dur: 10,
    what: 'Steel stakes are set on both sides of the road and tensioned stringlines run along them. The slip-form paver\'s sensors follow these lines for line and level.',
    req: [['Stakes', 'At ≤5 m centres on straights, closer on curves', 'IRC:15'], ['Stringline', 'Tensioned to avoid sag; level checked before paving', 'IRC:15']],
    machines: ['Survey crew'],
    qc: ['Stringline level against design', 'No disturbance during paving'],
  },
  {
    id: 'pav', name: 'Slip-form paving', day: 'Day 17, 06:00', dur: 64,
    what: 'Dumpers bring M40 paving concrete from the batching plant and tip it ahead of the placer-spreader. The slip-form paver spreads, vibrates and extrudes the full-width 300 mm slab between its moving side forms. The dowel-bar inserter (DBI) pushes dowels in at every joint, and the tie-bar inserter (TBI) places tie bars along the centre line. The texture-curing machine then drags burlap, tines the surface and sprays curing compound.',
    req: [['Concrete', 'M40, design flexural strength 4.5 MPa at 28 days', 'IRC:58, MoRTH 602'], ['Workability', 'Low slump for slip-form, ≈25 mm at the paver (as per trial)', 'MoRTH 602'], ['Temperature', 'Concrete ≤30 °C at placing; no paving below 5 °C', 'IRC:15, MoRTH 602'], ['Dowels', 'At mid-depth, parallel to the road and surface, one half debonded', 'IRC:15'], ['Texture', 'Burlap drag, then transverse tines: grooves ≈3 mm wide, 3 ± 1 mm deep, random 10–21 mm spacing', 'IRC:15, MoRTH 602'], ['Curing compound', 'Sprayed uniformly right after texturing (≈0.2–0.3 L/m²)', 'IRC:15']],
    machines: ['Batching plant', 'Dumpers', 'Placer-spreader', 'Slip-form paver with DBI and TBI', 'Texture-curing machine'],
    qc: ['Slump and temperature of every few loads', 'Beam and cube specimens', 'Edge slump and surface regularity behind the paver', 'Dowel alignment (MIT scan)'],
  },
  {
    id: 'saw', name: 'Saw cutting joints', day: 'Day 17, 10:00–Day 18', dur: 36,
    what: 'As soon as the concrete can be sawn without ravelling, contraction joints are cut every 4.5 m. The cut makes the slab crack straight down over the dowels. A second saw cuts the longitudinal joint over the tie bars.',
    req: [['Timing', 'As early as possible without ravelling, typically 4–24 h after placing (earlier in hot weather)', 'IRC:15'], ['Transverse joints', 'Every 4.5 m; initial cut 3–5 mm wide, ¼ to ⅓ of slab depth', 'IRC:15'], ['Longitudinal joint', 'Sawn to ⅓ of slab depth over the tie bars', 'IRC:15'], ['Alignment', 'Square to the centre line, over the dowels', 'IRC:15']],
    machines: ['Concrete saws'],
    qc: ['Time of cutting after placing', 'Depth of cut', 'Uncontrolled cracks (none allowed)'],
  },
  {
    id: 'cur', name: 'Wet curing', day: 'Days 17–31', dur: 16,
    what: 'Wet hessian covers the slab and a water tanker keeps it saturated so the concrete keeps hydrating and does not crack from drying shrinkage. No traffic is allowed.',
    req: [['Duration', '≥14 days of wet curing', 'IRC:15'], ['Covering', 'Hessian kept continuously wet', 'IRC:15'], ['Traffic', 'None on the slab during curing', 'IRC:15']],
    machines: ['Water tanker', 'Curing crew'],
    qc: ['Hessian wet at all times', 'Curing log'],
  },
  {
    id: 'seal', name: 'Joint sealing', day: 'Days 32–33', dur: 20,
    what: 'Each saw cut is widened into a sealing groove, cleaned with compressed air, primed and fitted with a backer rod, then filled with sealant. The seal keeps water and grit out of the joints.',
    req: [['Groove', 'Widened to ≈10 mm wide × 20–25 mm deep', 'IRC:15'], ['Backer rod', 'Closed-cell, sets the sealant depth', 'IRC:57'], ['Sealant', 'Polysulphide or silicone, recessed ≈3–5 mm below the surface', 'IRC:57, IRC:15']],
    machines: ['Sealing crew'],
    qc: ['Groove clean and dry', 'Sealant adhesion and recess'],
  },
  {
    id: 'open', name: 'Checks and opening', day: 'Days 34–45', dur: 24,
    what: 'Shoulders are finished and the road is marked. Surface regularity, thickness and strength are verified. The road opens to traffic only once the concrete reaches its design strength, and not before 28 days.',
    req: [['Regularity', '≤3 mm under a 3 m straightedge', 'MoRTH 902'], ['Strength', '28-day flexural strength ≥4.5 MPa (beams); cores for thickness', 'MoRTH 602'], ['Opening', 'Not before 28 days or design strength', 'IRC:15']],
    machines: ['Paver for shoulders', 'Marking crew', 'Test crew'],
    qc: ['3 m straightedge and roughness survey', 'Cores for thickness and density', 'Beam test results'],
  },
];

/** Typical dowel sizes by slab thickness (IRC:58 guidance; check the current edition). */
export const DOWELS = [
  { t: 200, d: 25, L: 360, s: 300 },
  { t: 230, d: 30, L: 400, s: 300 },
  { t: 250, d: 32, L: 450, s: 300 },
  { t: 280, d: 36, L: 450, s: 300 },
  { t: 300, d: 38, L: 500, s: 300 },
  { t: 350, d: 38, L: 500, s: 300 },
];
export const TIEBAR = { d: 12, L: 640, s: 600 };

export const REFS = [
  ['IRC:15-2017', 'Code of Practice for Construction of Jointed Plain Concrete Pavements'],
  ['IRC:58-2015', 'Guidelines for the Design of Plain Jointed Rigid Pavements for Highways'],
  ['IRC:57', 'Recommended Practice for Sealing of Joints in Concrete Pavements'],
  ['IRC:SP:49', 'Guidelines for the Use of Dry Lean Concrete as Sub-base for Rigid Pavement'],
  ['MoRTH Specifications (5th rev.)', 'Sections 300 (earthwork), 401 (GSB), 601 (DLC), 602 (PQC), 902 (surface regularity)'],
];
