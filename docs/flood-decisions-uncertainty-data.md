# Flood Emergencies: Decisions, Uncertainty and Data

> **One line:** This document looks at real Indian flood events to answer three questions: **which decisions** officials have to take during a flood, **what is uncertain** when they take them, and **which data** they need and **where it can be found**.

It supports [flood-evacuation-problem.md](flood-evacuation-problem.md) with evidence. It is research, not design: the design is in [flood-evacuation-solution.md](flood-evacuation-solution.md).

**How this was researched:** CAG audit reports, court and inquiry findings, government portals, news reports and research papers (full list in [section 8](#8-sources)). Most event facts come from **news summaries of official reports**, and several are disputed between the government and its critics. Before any number goes into a presentation, check it against the original report.

---

## 1. What real floods show

| Event | Decision that went wrong or came late | What was uncertain | What data was missing or failed |
|---|---|---|---|
| **Kosi breach, Bihar, 2008** | Embankment was not repaired and districts were not warned in time | Whether the embankment would hold | Warnings faxed to Bihar's liaison office in Nepal never arrived because the fax line was cut over unpaid bills. Wireless messages from the site about pressure on the spurs, sent from 31 July, were not acted on. The breach happened at about 15% of the design discharge. |
| **Chennai, 2015** | Emergency was declared late and the reservoir release was large and sudden | How much rain would fall and how full Chembarambakkam would get | The CAG said an emergency should have been declared when the water reached 21 ft on 16 Nov. The Collector and police were informed only on 1 Dec, at 22.5 ft. The reservoir's operating rules had not been revised in 23 years. The government disputes these findings. |
| **Kerala, 2018** | Dam shutters opened with little warning to people downstream | Rainfall on 15–17 Aug, which the state says was not forecast | The court-appointed amicus pointed to dams kept nearly full in early August, sudden discharges, no flood forecasting system for the dams, and no proper evacuation follow-up once dam safety levels were crossed. The state disputes this. |
| **Silchar, Assam, 2022** | Embankment breach was not plugged in time, and low-lying wards were not evacuated early | Whether and when the Bethukandi embankment would fail, and how fast the water would rise | The breach was reported by wireless on 23 May. Residents say a lane that was dry in the morning had water on the staircase by 11 PM. |
| **Sikkim GLOF, 2023** | Dams downstream did not get the order to open gates in time | Whether South Lhonak lake would burst | There was no early warning system at the lake, so the ITBP raised the first alarm. The Teesta-III dam at Chungthang was washed away within minutes, and the order to open gates reached the Dikchu dam at 2 AM, after the water. Communication around Chungthang was cut. |
| **Wayanad, 2024** | The evacuation of hill villages did not happen before the landslides | How much rain would fall on a small area in a few hours | IMD went from yellow (25 Jul) to orange (29 Jul) to red (early 30 Jul, after the landslides). Kerala says the rain was far heavier than forecast (about 572 mm in 48 hours) and that the GSI landslide system showed only green. A WhatsApp alert went out at 10:35 PM. The Centre and the state disagree on who was warned. |
| **Bihar and Assam, most years** | Evacuation orders are partly ignored | How many people will actually leave | NDRF officials say people stay back for fear of theft, for their cattle, and because earlier forecasts were wrong. In Saharsa in 2008 about 50,000 people refused to leave, and in Bihar in 2016 officials estimated over 1,00,000. |

**The pattern:** in almost every case the officials did not lack a rescue force. They lacked a **timely, trusted picture** of what was happening and of what was about to happen, and they had to decide anyway.

---

## 2. The decisions

These are the decisions taken during a flood, roughly in the order they come up.

| # | Decision | Who decides | Time available | Where it went wrong in section 1 |
|---|---|---|---|---|
| **D1** | **Whether and when to issue a warning or evacuation order** | District Collector / DDMA | Hours, sometimes less | Chennai, Wayanad, Silchar |
| **D2** | **Which areas go first** | DDMA, EOC | Hours | Silchar, Wayanad |
| **D3** | **Which shelters to open**, and who goes where | DDMA, Revenue dept. | Hours | Bihar (shelters people avoid) |
| **D4** | **Which routes to use**, and which roads or bridges to close | EOC, Police, PWD | Minutes to hours | Sikkim (13 bridges lost) |
| **D5** | **How to split boats, vehicles and NDRF/SDRF teams** across areas | EOC, NDRF/SDRF commanders | Minutes to hours | Bihar (boat shortage) |
| **D6** | **What to do in advance**: pre-position boats, guard or repair an embankment, open extra shelters | DDMA, Water Resources dept. | Days to hours | Kosi, Silchar |
| **D7** | **Whom to tell, and how**: siren, SMS, loudspeaker, WhatsApp, door-to-door | DDMA, Police | Minutes | Kerala, Sikkim, Wayanad |
| **D8** | **When to re-plan**: a bridge goes under, boats don't arrive, the network fails | EOC | Minutes | All of them |

**Out of scope but an input:** the **dam-release decision** is taken by the dam operator or Water Resources department, not the evacuation team. AEGIS-X treats it as an uncertain input ("the release could be anywhere from X to Y"), not as something it decides.

---

## 3. What is uncertain

Each uncertainty below is backed by at least one event or study from section 1. The last column shows whether the AEGIS-X engine models it today (`domains/flood/model.py`, `FloodConditions`).

| # | Uncertainty | Why it is uncertain (evidence) | Affects | Modelled now? |
|---|---|---|---|---|
| **U1** | **Rainfall amount and intensity** | Forecasts are ranges. Wayanad got about 572 mm in 48 hours. Kerala 2018 says the 15–17 Aug rain was not forecast. | D1, D2, D6 | ✅ `rainfall_mm` |
| **U2** | **River peak: how high, and when** | Depends on rain upstream, often in another state or Nepal. Assam's FLEWS gives alerts 12–36 hours ahead on average. | D1, D2 | ⬜ (derived from rainfall only) |
| **U3** | **Dam releases** | Decided by others, often late and large (Chennai 2015, Kerala 2018, Sikkim 2023). | D1, D2 | ⬜ |
| **U4** | **Embankment breach: whether, where, when** | Kosi 2008 failed well below design load. Silchar 2022 was a deliberate cut. | D1, D2, D6 | ⬜ |
| **U5** | **Road and bridge status** | Roads go under one by one. Sikkim lost 13 bridges. Reports conflict. | D4, D5 | ⬜ (only the knockout test) |
| **U6** | **How many people are where** | Census figures are old. Population moves by time of day. Some people leave on their own. | D2, D3, D5 | ⬜ (fixed in scenario) |
| **U7** | **How many people actually leave** | Refusal for property, cattle or distrust: 50,000 in Saharsa (2008). | D1, D2, D3 | ⬜ |
| **U8** | **Boats, vehicles and teams actually available, and when they arrive** | Bihar's boat gap (about half of need in an older report), hired boats, teams stuck elsewhere. | D5, D6 | ✅ `resource_availability_pct` |
| **U9** | **Shelter capacity and safety** | Shelters may flood, already be full, or be avoided. | D3 | ⬜ |
| **U10** | **Communication** | Towers run on batteries for about 8 hours. Kerala 2018: about 22,000 of 85,900 base stations disrupted. Sikkim: network around Chungthang cut. | D7, D8 | ✅ `comms_degradation_pct` |
| **U11** | **Whether a report is true and still current** | Conflicting reports, no reliability score, old by the time they arrive. | All | ⬜ (planned: data fusion) |
| **U12** | **Whether sensors are working** | CAG 2017: 222 of 375 CWC telemetry stations were non-functional after installation. CWC still relied on manual readings. | D1 | ⬜ |

**What this means for the engine:** three uncertainties are modelled today. **U3 (dam release), U4 (embankment breach), U5 (bridge status) and U7 (people who refuse)** come up again and again in real events and are the next ones worth adding as random conditions.

---

## 4. What data is needed

| Data | Decisions | Changes | Needed how often during a flood |
|---|---|---|---|
| Terrain elevation (DEM) | D2, D4 | Static | Once |
| Rivers, embankments and their weak spots | D2, D6 | Static | Once, plus breach reports |
| Road network with bridges and culverts | D4, D5 | Static | Once |
| Settlements and population | D2, D3, D5 | Static, with seasonal changes | Once |
| Vulnerable people (elderly, disabled, hospitals, schools) | D2 | Static | Once |
| Shelter list with capacity and elevation | D3 | Static | Once, plus occupancy updates |
| Past flood extents | D2, D6 | Yearly | Once (for validation) |
| Rainfall forecast as a range | D1, D6 | Dynamic | Every 3–6 hours |
| River level now and forecast | D1, D2 | Dynamic | Every 1–3 hours |
| Reservoir level and planned releases | D1, D2 | Dynamic | Every 1–3 hours |
| Current flood extent (satellite) | D2, D4 | Dynamic | Daily, when available |
| Road and bridge status | D4, D5 | Dynamic | As reported |
| Resources: boats, vehicles, teams, with location and status | D5 | Dynamic | Every hour |
| Shelter occupancy | D3 | Dynamic | Every few hours |
| Field reports (calls, teams, social media) | All | Dynamic | Continuous |
| Network status by area | D7, D8 | Dynamic | As reported |

---

## 5. Where to get it

Access details below come from the sources found during research and **may have changed**. Check each portal before relying on it.

### 5.1 Static data (the map)

| Data | Source | Access | Notes |
|---|---|---|---|
| Elevation | **CartoDEM 30 m** (ISRO, via Bhuvan) | Free download by tile, daily tile limit | Indian national DEM. Can be off by several metres in forests and on slopes. |
| Elevation (alternative) | SRTM 30 m (NASA) | Free | Easy to load in Python. |
| Roads, bridges, buildings, schools | **OpenStreetMap** via OSMnx | Free, Python | Rural coverage varies by district. Check the chosen district. |
| Population | Census of India; WorldPop (100 m grid) | Free | Census figures are old. WorldPop gives a grid that fits the map. |
| Past flood extents | **NRSC flood-affected area atlas** (1998–2022) and state flood hazard atlases (e.g. Assam), on the **NDEM** portal | Viewing on NDEM; downloads may need a request | Best source for "which areas flood first" and for validation. |
| Shelters | **District Disaster Management Plan** (DDMP), usually a PDF on the district website | Free, manual extraction | Lists relief camps, schools and community halls. |
| Resources inventory | **IDRN** (India Disaster Resource Network) | Government login | Equipment and trained staff by district. Not public. |

### 5.2 Live and forecast data

| Data | Source | Access | Notes |
|---|---|---|---|
| Rainfall forecast and nowcast | **IMD API** (api.imd.gov.in): district nowcast, district rainfall, warnings | Registration, key-based, IP whitelisting reported | Official. Single values and colour alerts rather than a range. |
| Historical rainfall | IMD gridded rainfall on data.gov.in | Free download | For building realistic rainfall ranges. |
| Rainfall/flow **as a range** | **GloFAS** (Copernicus): 51-member ensemble, 15 days ahead | Free with a CDS account, Python `cdsapi` | Gives the spread of possible futures directly. Good fit for Monte Carlo. |
| River forecast | **Google Flood Hub / Flood Forecasting API** | Free (CC BY 4.0), access on request | Riverine forecasts up to 7 days ahead. Started in Patna in 2018. |
| River levels | **CWC** flood forecasting network (about 180–200 stations); India-WRIS dashboards; daily CWC bulletins (PDF) | Free to view; no documented public API found | The official river-level source. Bulletins need PDF parsing. CWC's C-FLOOD covers some basins. |
| Reservoir levels | **CWC** reservoir bulletins (about 120–150 major reservoirs); state water resources department websites | Free, PDF/web | State sites cover far more reservoirs than CWC. Planned releases are usually not published in advance. |
| Current flood extent | **Copernicus Global Flood Monitoring** (Sentinel-1 radar); Bhuvan / NDEM flood maps | Free | Radar sees through cloud. Less reliable over towns and forests. Updated when the satellite passes, not hourly. |
| Official alerts | **SACHET** (NDMA common alerting platform: IMD, CWC, INCOIS and others) | Public portal, RSS | One feed for the warnings already issued. |
| Assam flood alerts | **FLEWS** (NESAC / ASDMA) | Public bulletins | Revenue-circle level alerts, 12–36 hours ahead on average. |

### 5.3 Tested and working (19 Oct 2026, Silchar area)

These were called live with no account or key:

| Data | Endpoint | Result |
|---|---|---|
| Rainfall forecast as a range | Open-Meteo Ensemble API (ECMWF, 51 members) | ✅ 51 rainfall values per day, so a min–max range comes directly |
| River discharge forecast as a range | Open-Meteo Flood API (GloFAS, 50 members) | ✅ 7-day discharge for the Barak near Silchar |
| Past rainfall | Open-Meteo Archive API (ERA5) | ✅ Silchar, June 2022: 40–64 mm/day from 15 to 19 June |
| Past river discharge | Open-Meteo Flood API (GloFAS reanalysis) | ✅ Barak near Silchar: about 640 m³/s on 17 June 2022, rising to about 1,215 m³/s on 19 June |
| Elevation at points | Open-Meteo Elevation API | ✅ 16–22 m around Silchar |
| Roads, bridges, hospitals | OpenStreetMap Overpass API | ✅ About 10 × 10 km box: 134 major roads, 59 bridges, 7 hospitals, but only 1 school tagged |
| Population grid (100 m) | WorldPop, India 2020 GeoTIFF | ✅ Available for download |

Caveats: ERA5 and GloFAS are coarse (about 5–25 km), so they **under-estimate local extremes** and the GloFAS cell may not be exactly the main channel. Use them for **ranges and trends**, not exact local values. OSM is missing many schools and shelters, so the DDMP shelter list is still needed.

Government portals checked: IMD API, Mausam, India-WRIS, NDEM and Bhuvan were reachable. The CWC flood forecast site returned an error (502) and SACHET blocked the request (403).

### 5.4 Data that does not exist anywhere as a feed

These matter most on the day but are **not published by anyone**:

- Which roads and bridges are open **right now**
- How many boats and teams are **actually ready**, and where
- How many people are **still inside** an area, and how many refuse to leave
- How full each shelter is
- Where the mobile network is down

They reach the control room as calls, wireless messages and WhatsApp forwards, often conflicting and often late. **This is exactly where AEGIS-X adds value:** it combines these reports with a confidence level (P1 in the problem document), treats what stays unknown as a range instead of guessing, and tells the officer **which of these unknowns is worth checking first** (P6).

---

## 6. Data plan for AEGIS-X

| Phase | Data | Purpose |
|---|---|---|
| **1. Demo (now)** | Fictional district with synthetic data, as in the current grid world | Show the engine without any real data dependency |
| **2. Real map, one district** | CartoDEM or SRTM, OSM roads, WorldPop, DDMP shelters, past flood extents from NDEM | Same engine on a real district's geography |
| **3. Historical replay** | One past event: past rainfall (IMD), river and reservoir levels (CWC bulletins), flood extent (Sentinel-1), news timelines | Replay the event hour by hour and show where earlier decisions would have helped. Silchar 2022 or Kerala 2018 are good candidates because they are well documented. |
| **4. Live (future)** | IMD API, GloFAS ensemble, Flood Hub, CWC, SACHET, field-report input form | Real-time use in a district EOC |

**Recommended next step:** pick **one district** for phase 2. An Assam district (for example Cachar, which includes Silchar) has a flood hazard atlas, FLEWS alerts, recurring floods and a well-reported 2022 event, so it supports phases 2 and 3 together.

---

## 7. Summary

| Question | Answer |
|---|---|
| **Which decisions?** | When to warn and evacuate, which areas first, which shelters, which routes, how to split resources, what to prepare in advance, how to tell people, when to re-plan |
| **What is uncertain?** | Rainfall, river peak, dam releases, embankment breaches, road and bridge status, where people are and whether they leave, which resources show up, shelter space, communication, and whether each report or sensor can be trusted |
| **What data?** | Static map data (terrain, roads, people, shelters, past floods) plus live data (rain, rivers, reservoirs, flood extent, alerts) plus field reports |
| **Where from?** | Static: CartoDEM, OSM, WorldPop, NDEM atlases, DDMPs. Live: IMD, GloFAS, Google Flood Hub, CWC, Copernicus, SACHET, FLEWS. Field status: nobody publishes it, so AEGIS-X must take it from reports and handle it as uncertainty. |

---

## 8. Sources

**Events**
- Kosi 2008: [Wikipedia: 2008 Bihar flood](https://en.wikipedia.org/wiki/2008_Bihar_flood) · [Outlook: Damned Waters](https://www.outlookindia.com/national/damned-waters-news-238386) · [Himal Southasian](https://www.himalmag.com/comment/why-embankments-are-not-the-solution-to-nepals-flood-woes) · [Down To Earth: inquiry report submitted](https://www.downtoearth.org.in/amp/story/environment/kosi-floods-inquiry-report-submitted-finally-43831)
- Chennai 2015: [The News Minute: CAG report](https://www.thenewsminute.com/amp/story/tamil-nadu/cag-report-slams-chennai-administration-2015-floods-says-govt-was-unprepared-84476) · [The News Minute: Chembarambakkam lapses](https://thenewsminute.com/article/how-grave-lapses-chembarambakkam-lake-caused-chennai-s-manmade-flood-2015-84524) · [The Wire](https://thewire.in/government/as-chennai-flooded-officials-fiddled)
- Kerala 2018: [Down To Earth: amicus curiae report](https://www.downtoearth.org.in/governance/amicus-curiae-flags-sudden-discharge-from-dams-lack-of-forecasting-for-kerala-floods-63823) · [Morung Express](https://morungexpress.com/did-keralas-dams-exacerbate-its-once-century-floods) · [The News Minute: Idukki sirens](https://www.thenewsminute.com/amp/story/kerala/lesson-kerala-floods-idukki-dams-get-sirens-alert-residents-shutter-opening-111991)
- Silchar 2022: [Scroll](https://scroll.in/article/1026724/scroll_in) · [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Fassams-silchar-still-under-water-cm-says-flood-was-man-made-1121543.html) · [EastMojo](https://eastmojo.com/assam/2022/06/25/use-mapping-to-identify-vulnerable-areas-in-silchar-suggests-expert/)
- Sikkim 2023: [The Wire](https://thewire.in/environment/sikkim-glof-triggered-flood-in-teesta-because-warnings-remained-neglected) · [Mongabay India](https://india.mongabay.com/2023/10/no-early-warning-system-and-insufficient-dam-safety-turned-sikkim-flood-deadly/) · [SANDRP](https://sandrp.in/2023/10/04/glacial-lake-flood-destroys-teesta-3-dam-in-sikkim-brings-wide-spread-destruction/) · [EastMojo: damage report](https://eastmojo.com/sikkim/2023/10/04/sikkim-govt-informs-extent-of-damage-caused-by-glacial-lake-outburst-flood/)
- Wayanad 2024: [Onmanorama: IMD chief](https://onmanorama.com/news/kerala/2024/08/01/regular-rainfall-warnings-issued-kerala-imd-wayanad-landslides.html) · [Deccan Herald: CM refutes](https://www.deccanherald.com/amp/story/india%2Fkerala%2Fkerala-cm-vijayan-refutes-amit-shahs-claim-that-centre-gave-advance-calamity-warning-to-state-3130653) · [The Week](https://www.theweek.in/news/india/2024/07/31/wayanad-landslide-political-war-erupts-after-amit-shah-says-kerala-was-given-early-warning.amp.html)
- People refusing to leave: [The Quint](https://www.thequint.com/amp/story/news/india/bihar-up-struggle-to-move-reluctant-locals-from-flood-hit-areas) · [NY Sun (2008)](https://www.nysun.com/article/foreign-50000-villagers-in-flooded-india-refuse-to-leave) · [ThePrint: Assam livestock](https://theprint.in/india/livestock-protection-key-challenge-as-floodwaters-recede-in-assam/2999212/)
- Boats and teams: [Down To Earth: Facing the flood](https://www.downtoearth.org.in/news/facing-the-flood-10046) · [UNI](https://test.uniindia.com/bihar-over-10-lakh-affected-as-rivers-swell-ndrf-sdrf-teams-deployed/east/news/3965333.html)
- Communication: [The News Minute: Chennai signal](https://www.thenewsminute.com/tamil-nadu/why-chennai-facing-poor-mobile-phone-signal-issues-36550) · [Voice&Data: Kerala towers](https://www.voicendata.com/indus-restores-mobile-connection-record-time-keralas-devastation)

**Audits and guidelines**
- [CAG Report No. 10 of 2017: press release](https://cag.gov.in/uploads/PressRelease/PR-Press-Release-Report-No-10-of-2017-05f60523797e5b0-12023410.pdf) · [PRS summary](https://PRSINDIA.org/files/policy/policy_committee_reports/CAG%20report%20summary%20on%20schemes%20for%20flood%20control%20and%20flood%20forecasting.pdf) · [Down To Earth: Kerala preparedness](https://www.downtoearth.org.in/natural-disasters/kerala-floods-how-to-hit-self-goals-on-disaster-preparedness-61595)
- [NDMA Guidelines: Management of Floods (2008), via Goa SDMA](https://sdma.goa.gov.in/konkani/sites/default/files/2022-05/flood.pdf)

**Research on evacuation decisions**
- [Bas (2016), risk-based evacuation under uncertainty, E3S](https://www.e3s-conferences.org/10.1051/e3sconf/20160719001)
- [Wojciechowska (2010), decision support for flood evacuation, WIT Press](https://www.witpress.com/elibrary/wit-transactions-on-ecology-and-the-environment/133/21034)
- [Wernstedt et al., how emergency managers use probabilistic forecasts (Univ. of Michigan)](https://deepblue.lib.umich.edu/bitstream/2027.42/146849/1/disa12293.pdf)
- [Natural Hazards (2025), Monte Carlo study of evacuation timing](https://link.springer.com/article/10.1007/s11069-025-07540-5)

**Data sources**
- [IMD API portal](https://api.imd.gov.in/) · [IMD gridded rainfall on data.gov.in](https://data.gov.in/resource/daily-rainfall-data-india-meteorological-department-imd-grid-model-agency-during-july-2023)
- [GloFAS](https://global-flood.emergency.copernicus.eu/general-information/about-glofas) · [GloFAS data access notes](https://aa-toolbox.readthedocs.io/en/stable/datasources/glofas.html)
- [Google Flood Forecasting](https://sites.research.google/floodforecasting) · [Flood Forecasting API](https://developers.google.com/flood-forecasting)
- [CWC daily flood bulletin (example)](https://cwc.gov.in/sites/default/files/cfcrcwcdfb15.07.2023.pdf) · [CWC reservoir bulletins](https://cwc.gov.in/hi/reservoir-level-storage-bulletin) · [C-FLOOD](https://www.deccanherald.com/amp/story/india%2Fcentre-unveils-c-flood-a-unified-flood-forecasting-system-3612789) · [SANDRP on reservoir data](https://sandrp.in/2018/07/13/how-india-measures-water-storages/)
- [Assam FLEWS (ASDMA)](https://asdma.gov.in/project_flood_warning.html) · [NESAC](https://nesac.gov.in/scientific-programmes/disaster-management-support/)
- [NDEM flyer (IDRN, flood atlas)](https://ndem.nrsc.gov.in/documents/downloads/v4/FLYER_NDEM_v4.0.pdf) · [NRSC flood atlas release](https://www.nrsc.gov.in/sites/default/files/pdf/DMSP/Releasefloodaffectedareaatlas_sba_2023_hindi.pdf) · [PIB on common alerting / SACHET](https://www.ndrf.gov.in/sites/default/files/STRENGTHENING%20DISASTER%20MANAGEMENT-Press%20Release_Press%20Information%20Bureau.pdf)
- [CartoDEM on data.gov.in](https://data.gov.in/catalog/digital-elevation-model-dem-generated-cartosat-1-satellite-data-india) · [NRSC CartoDEM](https://www.nrsc.gov.in/EOP_CDEM_Objective)
- [Copernicus Global Flood Monitoring (CIMA)](https://www.cimafoundation.org/en/project/global-flood-monitoring/)
