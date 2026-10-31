# कुंभनगरी · Kumbh City

A 3D crowd and transport simulator of Nashik during the Simhastha Kumbh Mela. Plan the city for a normal mela day, a parva snan or an Amrit Snan, then watch the day unfold.

- **City:** a stylised Nashik with:
  - the Godavari and the Kapila
  - Ramkund and nine ghats
  - Panchavati and the Kalaram temple
  - the Holkar bridge
  - the Tapovan Sadhugram with its akhara camps
  - Dasak, Nashik Road station, and outer parking hubs on every highway
- **Pilgrims:** pilgrims move in groups of 250. Each group:
  - parks at an outer hub or arrives by special train
  - rides an MSRTC electric shuttle (or walks) to a transfer point
  - walks through the vehicle-free zone to a ghat
  - queues and takes a holy dip
  - may visit Kalaram for darshan
  - goes home the same way

  Walking speed falls with crowd density, and full streets back up. Above 4 people/m² counts as critical.
- **Amrit Snan:** the three Vaishnav akharas process from Tapovan to Ramkund at dawn. The Ramkund complex is reserved for them until 09:30. The Godavari maha aarti and floating diyas follow in the evening.
- **Plan:**
  - extend ghats
  - add shuttles and parking hubs, and run Deolali special trains
  - one-way circulation, holding areas and an ICCC (integrated command and control centre) that diverts pilgrims and moves buses
  - widen bottlenecks and add a pontoon bridge
  - toilets, medical posts and a Gangapur dam release

  Everything is costed against a ₹600 crore budget.
- **Results:**
  - Live: KPIs, an hourly chart, density colouring, critical-crowding alerts and plain-language advice.
  - End of day: a report with a score and grade.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#sc=amrit
```

The map is stylised, and capacities and costs are illustrative. This is not affiliated with the Kumbh Mela Authority, the Government of Maharashtra or MSRTC.

Docs: `docs/projects/nashik-kumbh/`.
