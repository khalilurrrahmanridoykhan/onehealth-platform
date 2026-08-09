// Ported from the OneHealth Platform repo's data/evidence_registry.json and
// dhis2/mappings/*.json. Unlike that repo's FastAPI service, this app reads
// no CSV files and has no separate backend: everything it displays is either
// this static configuration (what a programme *is* and where its data lives)
// or live data values pulled from this DHIS2 instance's own API.

export type FreshnessMode = 'operational' | 'historical'
export type PeriodType = 'Weekly' | 'SixMonthly' | 'Yearly'

export interface ProgrammeLocation {
  code: string
  uid: string
  name: string
  level: 'national' | 'division'
}

export interface ProgrammeCapabilities {
  alerts: boolean
  forecast: boolean
  automatedRefresh: boolean
  districtData: boolean
}

export interface ProgrammeConfig {
  code: string
  name: string
  metricLabel: string
  metricUnit: string
  evidenceType: string
  freshnessMode: FreshnessMode
  expectedUpdateDays: number | null
  allowedDataStatuses: string[]
  license: string | null
  doi: string | null
  capabilities: ProgrammeCapabilities
  limitations: string[]
  periodType: PeriodType
  sourceName: string
  sourceUrl: string
  dataSetUid: string
  casesDataElementUid: string
  nationalCasesDataElementUid: string
  locations: ProgrammeLocation[]
}

export const PROGRAMMES: ProgrammeConfig[] = [
  {
    code: 'DENGUE',
    name: 'Dengue',
    metricLabel: 'Admitted dengue cases',
    metricUnit: 'cases',
    evidenceType: 'observed_surveillance',
    freshnessMode: 'operational',
    expectedUpdateDays: 7,
    allowedDataStatuses: ['observed'],
    license: null,
    doi: null,
    capabilities: { alerts: true, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'The committed snapshot ends in 2026-W22 and is not a live DGHS feed.',
      'Division weekly values are supplied aggregates and do not prove facility-level reporting completeness.',
      'No district-level observations or population denominators are available.',
    ],
    periodType: 'Weekly',
    sourceName: 'DGHS HEOC Dengue Dynamic Dashboard',
    sourceUrl: 'https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php',
    dataSetUid: 'OhDngWeek01',
    casesDataElementUid: 'OhDngCase01',
    nationalCasesDataElementUid: 'OhDngNat001',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-BAR', uid: 'BdDivBar001', name: 'Barishal', level: 'division' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-DHA', uid: 'BdDivDha001', name: 'Dhaka', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-MYM', uid: 'BdDivMym001', name: 'Mymensingh', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
      { code: 'BD-SYL', uid: 'BdDivSyl001', name: 'Sylhet', level: 'division' },
    ],
  },
  {
    code: 'MEASLES',
    name: 'Measles',
    metricLabel: 'Suspected measles cases',
    metricUnit: 'cases',
    evidenceType: 'observed_surveillance',
    freshnessMode: 'operational',
    expectedUpdateDays: 7,
    allowedDataStatuses: ['observed'],
    license: null,
    doi: null,
    capabilities: { alerts: true, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'The series contains suspected cases, not laboratory-confirmed measles cases.',
      'Only five divisions have complete weekly source coverage in the current snapshot; unavailable values are not estimated.',
      'Mymensingh Division and district-level observations are unavailable.',
    ],
    periodType: 'Weekly',
    sourceName: 'DGHS Bangladesh measles press releases',
    sourceUrl: 'https://dghs.gov.bd/pages/press-releases/',
    dataSetUid: 'OhMslWeek01',
    casesDataElementUid: 'OhMslCase01',
    nationalCasesDataElementUid: 'OhMslNat001',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-BAR', uid: 'BdDivBar001', name: 'Barishal', level: 'division' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-DHA', uid: 'BdDivDha001', name: 'Dhaka', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
      { code: 'BD-SYL', uid: 'BdDivSyl001', name: 'Sylhet', level: 'division' },
    ],
  },
  {
    code: 'HPAI',
    name: 'Avian Influenza (HPAI)',
    metricLabel: 'Reported HPAI outbreaks',
    metricUnit: 'outbreaks',
    evidenceType: 'observed_outbreak_reports',
    freshnessMode: 'operational',
    expectedUpdateDays: 183,
    allowedDataStatuses: ['observed'],
    license: null,
    doi: null,
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'The WAHIS export is a sparse reported-outbreak series; absent semesters are missing, not zero.',
      'The source uses historical seven-division geography, so Mymensingh is not separately reported.',
      'The normalized cases field represents outbreaks, not infected people or animals.',
    ],
    periodType: 'SixMonthly',
    sourceName: 'WOAH WAHIS quantitative animal-disease data',
    sourceUrl: 'https://wahis.woah.org/#/dashboards/qd-dashboard',
    dataSetUid: 'OhHpaiSem01',
    casesDataElementUid: 'OhHpaiOut01',
    nationalCasesDataElementUid: 'OhHpaiNat01',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-BAR', uid: 'BdDivBar001', name: 'Barishal', level: 'division' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-DHA', uid: 'BdDivDha001', name: 'Dhaka', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-MYM', uid: 'BdDivMym001', name: 'Mymensingh', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
      { code: 'BD-SYL', uid: 'BdDivSyl001', name: 'Sylhet', level: 'division' },
    ],
  },
  {
    code: 'NIPAH',
    name: 'Nipah Virus',
    metricLabel: 'Reported Nipah cases',
    metricUnit: 'cases',
    evidenceType: 'historical_literature_compilation',
    freshnessMode: 'historical',
    expectedUpdateDays: null,
    allowedDataStatuses: [
      'cross_validated_literature',
      'single_source_literature',
      'cumulative_literature_2001_2021',
      'historical_literature_compilation',
    ],
    license: null,
    doi: '10.1371/journal.pntd.0011617',
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'This is a retrospective literature compilation, not a live surveillance feed.',
      'National annual values and division values do not share the same temporal meaning.',
      'Division values are cumulative affected-district totals for 2001-2021 and must not be interpreted as annual incidence.',
    ],
    periodType: 'Yearly',
    sourceName: 'Satter et al. (2023) and Bhowmik et al. (2024) literature compilation',
    sourceUrl: 'https://doi.org/10.1371/journal.pntd.0011617',
    dataSetUid: 'OhNipAnn001',
    casesDataElementUid: 'OhNipDivC01',
    nationalCasesDataElementUid: 'OhNipNatC01',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-BAR', uid: 'BdDivBar001', name: 'Barishal', level: 'division' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-DHA', uid: 'BdDivDha001', name: 'Dhaka', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-MYM', uid: 'BdDivMym001', name: 'Mymensingh', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
      { code: 'BD-SYL', uid: 'BdDivSyl001', name: 'Sylhet', level: 'division' },
    ],
  },
  {
    code: 'JE',
    name: 'Japanese Encephalitis',
    metricLabel: 'Laboratory-confirmed sentinel cases',
    metricUnit: 'cases',
    evidenceType: 'historical_sentinel_surveillance',
    freshnessMode: 'historical',
    expectedUpdateDays: null,
    allowedDataStatuses: [
      'single_source_literature',
      'partial_year_through_july',
      'historical_sentinel_surveillance',
    ],
    license: null,
    doi: '10.1016/j.ijid.2020.07.026',
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'Counts come from four hospital sentinel sites and are not population-wide division incidence.',
      'The 2016 reporting period ends in July and is explicitly partial.',
      'No mortality series, district coverage, operational alert, or forecast is supported.',
    ],
    periodType: 'Yearly',
    sourceName: 'Paul et al. (2020) hospital-based sentinel surveillance',
    sourceUrl: 'https://doi.org/10.1016/j.ijid.2020.07.026',
    dataSetUid: 'OhJeAnn0001',
    casesDataElementUid: 'OhJeDivC001',
    nationalCasesDataElementUid: 'OhJeNatC001',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
    ],
  },
  {
    code: 'AWD',
    name: 'Acute Watery Diarrhoea',
    metricLabel: 'Estimated acute watery diarrhoea cases',
    metricUnit: 'cases',
    evidenceType: 'literature_derived_ecological_estimate',
    freshnessMode: 'historical',
    expectedUpdateDays: null,
    allowedDataStatuses: ['literature_derived_ecological_estimate'],
    license: null,
    doi: null,
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'Values are literature-derived ecological estimates, not authenticated EWARS or facility observations.',
      'Division estimates use proxy weights and must not be presented as directly reported counts.',
      'The series is unsuitable for operational outbreak alerts or forecasts.',
    ],
    periodType: 'Yearly',
    sourceName: 'Kabir et al. (2025) and Ali et al. (2023) literature-derived estimates',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11922245/',
    dataSetUid: 'OhAwdAnn001',
    casesDataElementUid: 'OhAwdDivC01',
    nationalCasesDataElementUid: 'OhAwdNatC01',
    locations: [
      { code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' },
      { code: 'BD-BAR', uid: 'BdDivBar001', name: 'Barishal', level: 'division' },
      { code: 'BD-CTG', uid: 'BdDivCtg001', name: 'Chattogram', level: 'division' },
      { code: 'BD-DHA', uid: 'BdDivDha001', name: 'Dhaka', level: 'division' },
      { code: 'BD-KHU', uid: 'BdDivKhu001', name: 'Khulna', level: 'division' },
      { code: 'BD-MYM', uid: 'BdDivMym001', name: 'Mymensingh', level: 'division' },
      { code: 'BD-RAJ', uid: 'BdDivRaj001', name: 'Rajshahi', level: 'division' },
      { code: 'BD-RAN', uid: 'BdDivRan001', name: 'Rangpur', level: 'division' },
      { code: 'BD-SYL', uid: 'BdDivSyl001', name: 'Sylhet', level: 'division' },
    ],
  },
  {
    code: 'RABIES',
    name: 'Human Rabies',
    metricLabel: 'Reported human rabies deaths',
    metricUnit: 'deaths',
    evidenceType: 'official_reported_mortality',
    freshnessMode: 'operational',
    expectedUpdateDays: 365,
    allowedDataStatuses: ['who_reported_national_deaths'],
    license: null,
    doi: null,
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'The normalized cases slot contains reported deaths for this programme.',
      'Only annual national WHO GHO values are available; no division or district data are present.',
      'The retrospective annual series does not support outbreak alerts or forecasts.',
    ],
    periodType: 'Yearly',
    sourceName: 'WHO Global Health Observatory (NTD_RAB2)',
    sourceUrl: 'https://www.who.int/data/gho',
    dataSetUid: 'OhRabAnn001',
    casesDataElementUid: 'OhRabNatD01',
    nationalCasesDataElementUid: 'OhRabNatD01',
    locations: [{ code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' }],
  },
  {
    code: 'MALARIA',
    name: 'Malaria',
    metricLabel: 'Confirmed malaria cases',
    metricUnit: 'cases',
    evidenceType: 'official_reported_confirmed_cases',
    freshnessMode: 'operational',
    expectedUpdateDays: 365,
    allowedDataStatuses: ['who_reported_confirmed_cases'],
    license: null,
    doi: null,
    capabilities: { alerts: false, forecast: false, automatedRefresh: false, districtData: false },
    limitations: [
      'Only annual national WHO GHO values are available; no division or district data are present.',
      'The series records confirmed cases and must not be combined with the separate synthetic malaria training dataset.',
      'The retrospective annual series does not support outbreak alerts or forecasts.',
    ],
    periodType: 'Yearly',
    sourceName: 'WHO Global Health Observatory — confirmed malaria cases',
    sourceUrl: 'https://ghoapi.azureedge.net/api/MALARIA_CONF_CASES',
    dataSetUid: 'OhMalAnn001',
    casesDataElementUid: 'OhMalNatC01',
    nationalCasesDataElementUid: 'OhMalNatC01',
    locations: [{ code: 'BD', uid: 'BdOrgUnit01', name: 'Bangladesh', level: 'national' }],
  },
]

export function programmeByCode(code: string): ProgrammeConfig | undefined {
  return PROGRAMMES.find((programme) => programme.code === code)
}
