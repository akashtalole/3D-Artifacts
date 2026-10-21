/**
 * Forts associated with Chhatrapati Shivaji Maharaj.
 * Facts are summarised from public sources (Maharashtra Tourism, ASI, UNESCO, Wikipedia) and
 * kept deliberately cautious; dates marked "c." are traditional or approximate.
 *
 * walls: rings traced on the real terrain by casting rays from the summit until the ground
 *   drops `drop` metres below the summit (hill forts) or reaches sea level (`level`, sea forts).
 * structures: placed by rule ("summit", "inner", "low", "spur:N", "steep:N", "gate:N").
 *   Their positions are indicative, not surveyed.
 */
export const UNESCO_NOTE = 'Part of the “Maratha Military Landscapes of India”, inscribed on the UNESCO World Heritage List in July 2025 (12 forts: 11 in Maharashtra and Gingee in Tamil Nadu).';

export const FORTS = [
  {
    id: 'shivneri', name: 'Shivneri', mr: 'शिवनेरी', kind: 'hill', district: 'Pune · Junnar', unesco: true,
    summary: 'Birthplace of Chhatrapati Shivaji Maharaj (19 February 1630). A long, cliff-girt hill above Junnar, climbed through a series of gates.',
    highlights: ['Shivkunj, the birthplace building', 'Shivai Devi temple: Shivaji Maharaj was named after the goddess', 'Badami Talav water tank', 'Ambarkhana granary', 'Seven gates on the main ascent'],
    events: [[1630, 'Birth of Shivaji Maharaj (19 February)']],
    walls: [{ drop: 80, maxR: 700 }],
    structures: [{ type: 'birthplace', label: 'Shivkunj (birthplace)', at: 'center' }, { type: 'temple', label: 'Shivai Devi temple', at: 'inner' }, { type: 'tank', label: 'Badami Talav', at: 'low' }, { type: 'granary', label: 'Ambarkhana', at: 'inner' }],
  },
  {
    id: 'torna', name: 'Torna', mr: 'तोरणा', kind: 'hill', district: 'Pune · Velhe', unesco: false,
    summary: 'Also called Prachandagad. Captured by the young Shivaji Maharaj around 1646, and traditionally counted as the first fort of Swarajya. Treasure found here is said to have paid for the building of Rajgad.',
    highlights: ['Highest fort in Pune district (about 1,400 m)', 'Zunjar Machi and Budhla Machi, its two fortified spurs', 'Menghai Devi temple'],
    events: [[1646, 'Torna captured: the first fort of Swarajya (c. 1646)']],
    walls: [{ drop: 100, maxR: 1100 }],
    structures: [{ type: 'temple', label: 'Menghai Devi temple', at: 'summit' }, { type: 'machi', label: 'Machi (fortified spur)', at: 'spur:0' }, { type: 'machi', label: 'Machi (fortified spur)', at: 'spur:1' }],
  },
  {
    id: 'rajgad', name: 'Rajgad', mr: 'राजगड', kind: 'hill', district: 'Pune · Velhe', unesco: true,
    summary: 'The first capital of Swarajya for about 25 years, before the move to Raigad. A citadel, the Bale Killa, crowns three fortified spurs: Padmavati, Suvela and Sanjivani Machi.',
    highlights: ['Bale Killa citadel', 'Padmavati, Suvela and Sanjivani Machis', 'Padmavati lake and temple', 'Rajaram Maharaj was born here in 1670'],
    events: [[1670, 'Birth of Rajaram Maharaj at Rajgad']],
    walls: [{ drop: 30, maxR: 220 }, { drop: 165, maxR: 1400 }],
    structures: [{ type: 'citadel', label: 'Bale Killa', at: 'summit' }, { type: 'machi', label: 'Machi', at: 'spur:0' }, { type: 'machi', label: 'Machi', at: 'spur:1' }, { type: 'machi', label: 'Machi', at: 'spur:2' }, { type: 'tank', label: 'Padmavati lake', at: 'low' }, { type: 'temple', label: 'Padmavati temple', at: 'inner' }],
  },
  {
    id: 'sinhagad', name: 'Sinhagad', mr: 'सिंहगड', kind: 'hill', district: 'Pune · Haveli', unesco: false,
    summary: 'Formerly Kondhana. In February 1670 Tanaji Malusare scaled its cliffs at night to recapture it and fell in the battle. Tradition remembers Shivaji Maharaj’s words: “Gad aala, pan sinha gela”, the fort is won but the lion is lost.',
    highlights: ['Kalyan Darwaja and Pune Darwaja', 'Memorial of Tanaji Malusare', 'Samadhi of Chhatrapati Rajaram Maharaj', 'Dev Taake water tank'],
    events: [[1670, 'Battle of Sinhagad: Tanaji Malusare falls (February)']],
    walls: [{ drop: 60, maxR: 800 }],
    structures: [{ type: 'memorial', label: 'Tanaji Malusare memorial', at: 'inner' }, { type: 'samadhi', label: 'Rajaram Maharaj samadhi', at: 'inner' }, { type: 'tank', label: 'Dev Taake', at: 'low' }],
  },
  {
    id: 'purandar', name: 'Purandar', mr: 'पुरंदर', kind: 'hill', district: 'Pune · Purandar', unesco: false,
    summary: 'Birthplace of Chhatrapati Sambhaji Maharaj (1657). Besieged by Mirza Raja Jai Singh in 1665; the Treaty of Purandar that followed handed 23 forts to the Mughals.',
    highlights: ['Upper fort (Bale Killa) and lower machi', 'Kedareshwar temple on the summit', 'Twin fort Vajragad nearby'],
    events: [[1657, 'Birth of Sambhaji Maharaj at Purandar'], [1665, 'Treaty of Purandar (June): 23 forts ceded']],
    walls: [{ drop: 45, maxR: 400 }, { drop: 110, maxR: 1100 }],
    structures: [{ type: 'temple', label: 'Kedareshwar temple', at: 'summit' }, { type: 'machi', label: 'Machi', at: 'spur:0' }],
  },
  {
    id: 'pratapgad', name: 'Pratapgad', mr: 'प्रतापगड', kind: 'hill-forest', district: 'Satara · Mahabaleshwar', unesco: true,
    summary: 'Built in 1656 on Shivaji Maharaj’s orders by Moropant Pingle to guard the Par ghat. On 10 November 1659 Afzal Khan was killed at a meeting below the fort, followed by a decisive Maratha victory.',
    highlights: ['Upper and lower forts', 'Bhavani Mata temple', 'Equestrian statue of Shivaji Maharaj (unveiled 1957)', 'Kedareshwar temple'],
    events: [[1656, 'Pratapgad built under Moropant Pingle'], [1659, 'Battle of Pratapgad: Afzal Khan defeated (10 November)']],
    walls: [{ drop: 30, maxR: 260 }, { drop: 100, maxR: 650 }],
    structures: [{ type: 'statue', label: 'Equestrian statue', at: 'summit' }, { type: 'temple', label: 'Bhavani Mata temple', at: 'inner' }, { type: 'tank', label: 'Tank', at: 'low' }],
  },
  {
    id: 'raigad', name: 'Raigad', mr: 'रायगड', kind: 'hill', district: 'Raigad · Mahad', unesco: true,
    summary: 'The capital of Swarajya. Shivaji Maharaj was crowned Chhatrapati here on 6 June 1674 and passed away here on 3 April 1680. A vast plateau ringed by sheer cliffs, reached by a long stairway or by ropeway.',
    highlights: ['Raj Sadar, the throne court', 'Maha Darwaja', 'Hirkani Buruj', 'Takmak Tok cliff', 'Jagdishwar temple', 'Samadhi of Shivaji Maharaj', 'Bazaar Peth market street', 'Ganga Sagar lake'],
    events: [[1656, 'Rairi taken from the Mores (later renamed Raigad)'], [1674, 'Coronation of Chhatrapati Shivaji Maharaj (6 June)'], [1680, 'Shivaji Maharaj passes away at Raigad (3 April)']],
    walls: [{ drop: 60, maxR: 1300 }],
    structures: [{ type: 'throne', label: 'Raj Sadar (throne court)', at: 'summit' }, { type: 'samadhi', label: 'Samadhi of Shivaji Maharaj', at: 'inner' }, { type: 'temple', label: 'Jagdishwar temple', at: 'inner' }, { type: 'bazaar', label: 'Bazaar Peth', at: 'inner' }, { type: 'tank', label: 'Ganga Sagar', at: 'low' }, { type: 'cliff', label: 'Takmak Tok', at: 'steep:0' }, { type: 'bastion', label: 'Hirkani Buruj', at: 'steep:1' }],
  },
  {
    id: 'lohagad', name: 'Lohagad', mr: 'लोहगड', kind: 'hill', district: 'Pune · Maval', unesco: true,
    summary: 'An iron-strong hill fort above the old Bor ghat trade route near Lonavala, with a long fortified spur called Vinchu Kata (the scorpion’s tail). Surrendered under the Treaty of Purandar and retaken in 1670.',
    highlights: ['Ganesh, Narayan, Hanuman and Maha Darwaja in a row', 'Vinchu Kata spur', 'Sixteen-sided tank', 'Twin fort Visapur'],
    events: [[1670, 'Lohagad retaken by the Marathas']],
    walls: [{ drop: 130, maxR: 1200 }],
    structures: [{ type: 'machi', label: 'Vinchu Kata', at: 'spur:0' }, { type: 'tank', label: 'Sixteen-sided tank', at: 'low' }, { type: 'temple', label: 'Shrine', at: 'inner' }],
  },
  {
    id: 'panhala', name: 'Panhala', mr: 'पन्हाळा', kind: 'hill-plateau', district: 'Kolhapur · Panhala', unesco: true,
    summary: 'One of the largest forts of the Deccan. Besieged by Siddi Jauhar in 1660; on the night of 12–13 July Shivaji Maharaj slipped out towards Vishalgad while Baji Prabhu Deshpande held the pass at Ghodkhind (Pavankhind) with his life.',
    highlights: ['Teen Darwaja', 'Andhar Bavdi (hidden well)', 'Sajja Kothi', 'Ambarkhana granaries'],
    events: [[1660, 'Siege of Panhala and escape to Vishalgad (12–13 July)']],
    walls: [{ drop: 30, maxR: 1500 }],
    structures: [{ type: 'gatehouse', label: 'Teen Darwaja', at: 'gate:0' }, { type: 'well', label: 'Andhar Bavdi', at: 'low' }, { type: 'pavilion', label: 'Sajja Kothi', at: 'steep:0' }, { type: 'granary', label: 'Ambarkhana', at: 'inner' }],
  },
  {
    id: 'salher', name: 'Salher', mr: 'साल्हेर', kind: 'hill', district: 'Nashik · Baglan', unesco: true,
    summary: 'The highest fort in the Sahyadri, at about 1,567 m. In 1672 the Marathas won a major open-field battle against the Mughals here.',
    highlights: ['Parshuram temple on the summit', 'Rock-cut caves and cisterns', 'Twin fort Salota'],
    events: [[1672, 'Battle of Salher: Maratha victory in the open field']],
    walls: [{ drop: 100, maxR: 900 }],
    structures: [{ type: 'temple', label: 'Parshuram temple', at: 'summit' }, { type: 'tank', label: 'Cistern', at: 'low' }, { type: 'cave', label: 'Rock-cut caves', at: 'steep:0' }],
  },
  {
    id: 'sindhudurg', name: 'Sindhudurg', mr: 'सिंधुदुर्ग', kind: 'island', district: 'Sindhudurg · Malvan', unesco: true,
    summary: 'Sea fort on Kurte island off Malvan, begun in 1664 under Hiroji Indulkar as a base for the Maratha navy. Its winding, bastioned walls hide the main gate from the sea.',
    highlights: ['Shivrajeshwar temple, dedicated to Shivaji Maharaj', 'Impressions of his palm and footprint', 'Hidden main gate', 'Freshwater wells on a sea island'],
    events: [[1664, 'Foundation of Sindhudurg laid at Malvan']],
    walls: [{ level: 0.8, maxR: 700 }],
    structures: [{ type: 'temple', label: 'Shivrajeshwar temple', at: 'center' }, { type: 'well', label: 'Freshwater wells', at: 'inner' }],
  },
  {
    id: 'vijaydurg', name: 'Vijaydurg', mr: 'विजयदुर्ग', kind: 'coastal', district: 'Sindhudurg · Devgad', unesco: true,
    summary: 'Coastal fort at the mouth of the Waghotan creek, first built in the Shilahara era as Gheria. Taken by Shivaji Maharaj and strengthened with triple walls, it later became a main base of the Maratha navy under the Angres.',
    highlights: ['Triple line of walls', 'Many bastions facing the sea', 'Naval docks in the creek'],
    events: [[1653, 'Vijaydurg taken and strengthened (c. 1653)']],
    walls: [{ level: 1.2, maxR: 270 }, { level: 1.2, maxR: 270, scale: 0.8 }, { level: 1.2, maxR: 270, scale: 0.6 }],
    structures: [{ type: 'citadel', label: 'Citadel', at: 'center' }, { type: 'well', label: 'Well', at: 'inner' }],
  },
  {
    id: 'suvarnadurg', name: 'Suvarnadurg', mr: 'सुवर्णदुर्ग', kind: 'island', district: 'Ratnagiri · Harnai', unesco: true,
    summary: 'The “Golden Fort” on an island off Harnai. Taken by Shivaji Maharaj around 1660 and refortified, it later served the Maratha navy.',
    highlights: ['Island fort with a hidden entrance', 'Shore forts at Harnai facing it'],
    events: [[1660, 'Suvarnadurg taken and refortified (c. 1660)']],
    walls: [{ level: 0.8, maxR: 500 }],
    structures: [{ type: 'temple', label: 'Shrine', at: 'center' }, { type: 'well', label: 'Well', at: 'inner' }],
  },
  {
    id: 'khanderi', name: 'Khanderi', mr: 'खांदेरी', kind: 'island', district: 'Raigad · Alibag', unesco: true,
    summary: 'Island fort near the mouth of Mumbai harbour, fortified in 1679 by Shivaji Maharaj’s navy despite resistance from the English and the Siddis. Today it carries a lighthouse.',
    highlights: ['Lighthouse on the island’s hill', 'Twin islet Underi'],
    events: [[1679, 'Khanderi fortified despite English and Siddi opposition']],
    walls: [{ level: 0.8, maxR: 600 }],
    structures: [{ type: 'lighthouse', label: 'Lighthouse', at: 'summit' }, { type: 'temple', label: 'Shrine', at: 'inner' }],
  },
];

export const CITIES = [['Mumbai', 19.076, 72.8777], ['Pune', 18.5204, 73.8567], ['Nashik', 19.9975, 73.7898], ['Kolhapur', 16.705, 74.2433], ['Ratnagiri', 16.9902, 73.312]];

/** Timeline of Shivaji Maharaj's life through the forts (plus key events not tied to one fort). */
export const TIMELINE = [
  ...FORTS.flatMap((f) => f.events.map(([y, t]) => ({ year: y, text: t, fort: f.id }))),
  { year: 1666, text: 'Escape from Agra (August)', fort: null },
].sort((a, b) => a.year - b.year);
