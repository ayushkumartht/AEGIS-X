/**
 * Real flood events used as case studies. Every number is quoted from the
 * linked source; nothing here is estimated by AEGIS-X.
 */
export type CaseStudy = {
  id: string
  place: string
  when: string
  title: string
  image: string
  imageAlt: string
  imageCredit: string
  facts: { value: string; label: string }[]
  challenge: string
  aegis: string[]
  source: { label: string; url: string }
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'chennai-2015',
    place: 'Chennai, Tamil Nadu',
    when: 'December 2015',
    title: 'A record storm on ground that was already full',
    image: '/images/army-rescue.jpg',
    imageAlt: 'Army personnel evacuating residents by boat from a flooded street in Chennai, December 2015',
    imageCredit: 'Ministry of Defence (PIB) · GODL-India',
    facts: [
      { value: 'Since 1901', label: 'no day had brought Chennai more rain than 1–2 December' },
      { value: '345 mm', label: 'fell in the storm, after 1,218.6 mm in November' },
      { value: '250+', label: 'people reported dead' },
    ],
    challenge:
      'The rain landed on a city already saturated by a record November. Every hour, the question changed: which roads and low-lying neighbourhoods would still be reachable by the time boats got there?',
    aegis: [
      'Sweep rainfall far beyond the forecast and see where the plan collapses',
      'Knockout-test roads and shelters to find the one the plan quietly depends on',
      'Re-run in seconds as each new rainfall report arrives',
    ],
    source: { label: 'NASA Earth Observatory', url: 'https://science.nasa.gov/earth/earth-observatory/historic-rainfall-floods-southeast-india-87131/' },
  },
  {
    id: 'kerala-2018',
    place: 'Kerala',
    when: 'August 2018',
    title: 'Almost an entire state underwater at once',
    image: '/images/kerala-after.jpg',
    imageAlt: 'False-colour satellite image of the flooded Kerala coast on 22 August 2018',
    imageCredit: 'NASA Earth Observatory · Landsat (USGS) & Copernicus Sentinel (ESA)',
    facts: [
      { value: '164%', label: 'more rain than normal in the first 20 days of August' },
      { value: '1M+', label: 'people displaced' },
      { value: '13 / 14', label: 'districts severely affected' },
    ],
    challenge:
      'When 13 districts flood together, boats, teams and shelter space are no longer a district problem. Every allocation to one place is a gap somewhere else.',
    aegis: [
      'Compare how boats and teams are split, on identical futures',
      'Rank which river gauge or road is most worth verifying first',
      'Pick the plan that holds in the worst 10% of futures, not the average',
    ],
    source: { label: 'NASA Earth Observatory', url: 'https://science.nasa.gov/earth/earth-observatory/a-flood-for-the-century-in-india-92638' },
  },
  {
    id: 'uttarakhand-2013',
    place: 'Uttarakhand',
    when: 'June 2013',
    title: 'When the only roads in are the ones that fail',
    image: '/images/uttarakhand-iaf.jpg',
    imageAlt: 'Indian Air Force rescue helicopters at Gauchar airstrip in flood-hit Uttarakhand, 26 June 2013',
    imageCredit: 'Ministry of Defence (PIB) · GODL-India',
    facts: [
      { value: '1,050+', label: 'people died; thousands more went missing' },
      { value: '744', label: 'villages and hamlets lost some or all connectivity' },
      { value: 'Rain + snowmelt', label: 'early monsoon rain met melting snow' },
    ],
    challenge:
      'In mountain valleys a single landslide can cut every road to a village. Helicopters became the lifeline — and there were only so many of them.',
    aegis: [
      'Remove each road or bridge in turn to find which cut strands the most people',
      'Test how far limited rescue capacity stretches in the futures where roads are lost',
      'Show which missing report (is this road open?) would change the plan most',
    ],
    source: { label: 'NASA Earth Observatory', url: 'https://science.nasa.gov/earth/earth-observatory/a-closer-look-at-flood-damage-in-india-81572/' },
  },
  {
    id: 'assam-2022',
    place: 'Assam',
    when: 'May – October 2022',
    title: 'Not one flood — wave after wave',
    image: '/images/assam-aerial.jpg',
    imageAlt: 'Aerial view of flooded villages in Assam with a single road still above water',
    imageCredit: 'Government of India (PIB), 2004 · GODL-India',
    facts: [
      { value: '5.6M', label: 'people affected across 32 of 35 districts' },
      { value: '564', label: 'relief camps running on 26 June' },
      { value: '217,413', label: 'people sheltering in those camps' },
    ],
    challenge:
      'Floods in Assam come in waves through the season. A plan built for the first wave has to be re-checked for the second — with shelters already full.',
    aegis: [
      'Re-run every plan in seconds as each new wave is forecast',
      'Judge plans by the worst 10% of futures, not the expected case',
      'Compare plans on identical futures before committing boats and teams',
    ],
    source: { label: 'IFRC DREF MDRIN027 · UNICEF SitRep (27 Jun 2022)', url: 'https://reliefweb.int/report/india/india-assam-floods-dref-operation-no-mdrin027-final-report' },
  },
]
