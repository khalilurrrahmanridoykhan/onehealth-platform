import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { AlertPanel } from './components/AlertPanel'
import { ComparisonWorkbench } from './components/ComparisonWorkbench'
import { EBSWorkspace } from './components/EBSWorkspace'
import { EBSOperationsQueue } from './components/EBSOperationsQueue'
import { EBSSignalRegistry } from './components/EBSSignalRegistry'
import { LocationTable } from './components/LocationTable'
import { RiskMap } from './components/RiskMap'
import { SummaryCards } from './components/SummaryCards'
import { SessionControl } from './components/SessionControl'
import { TrendChart } from './components/TrendChart'
import type { Alert, Disease, Location, OverviewItem, SurveillanceRecord } from './types'

export default function App() {
  const [locations, setLocations] = useState<Location[]>([])
  const [diseases, setDiseases] = useState<Disease[]>([])
  const [selectedDisease, setSelectedDisease] = useState('DENGUE')
  const [overview, setOverview] = useState<OverviewItem[]>([])
  const [selected, setSelected] = useState('BD')
  const [trend, setTrend] = useState<SurveillanceRecord[]>([])
  const [alert, setAlert] = useState<Alert>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [activeNav, setActiveNav] = useState('dashboard')

  useEffect(() => {
    api.diseases().then(setDiseases).catch((reason: Error) => setError(reason.message))
  }, [])

  useEffect(() => {
    setSelected('BD')
    Promise.all([api.locations(selectedDisease), api.overview(selectedDisease)])
      .then(([locationData, overviewData]) => {
        setLocations(locationData)
        setOverview(overviewData)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [selectedDisease])

  useEffect(() => {
    setLoading(true)
    setError(undefined)
    Promise.all([api.trend(selectedDisease, selected), api.alert(selectedDisease, selected)])
      .then(([trendData, alertData]) => {
        setTrend(trendData)
        setAlert(alertData)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [selectedDisease, selected])

  const selectedLocation = locations.find((location) => location.code === selected)
  const selectedSummary = useMemo(
    () => overview.find((item) => item.location_code === selected),
    [overview, selected],
  )
  const divisionOverview = overview.filter((item) => item.location_level === 'division')
  const highRiskCount = divisionOverview.filter((item) => item.risk_level === 'HIGH').length
  const latestPeriod = overview.find((item) => item.location_code === 'BD')?.latest_period ?? 'Waiting for data'
  const diseaseName =
    diseases.find((disease) => disease.code === selectedDisease)?.name ??
    `${selectedDisease.charAt(0)}${selectedDisease.slice(1).toLowerCase()}`
  const metricLabel = selectedDisease === 'HPAI' ? 'reported outbreaks' : selectedDisease === 'NIPAH' ? 'reported cases' : selectedDisease === 'AWD' ? 'estimated AWD cases' : 'cases'
  const periodLabel = selectedDisease === 'HPAI' ? 'semester' : ['NIPAH', 'JE', 'AWD'].includes(selectedDisease) ? 'year' : 'week'
  const historicalOnly = ['HPAI', 'NIPAH', 'JE', 'AWD'].includes(selectedDisease)

  const navigation = [
    ['dashboard', 'OV', 'Command overview'], ['surveillance', 'TR', 'Trends & forecast'],
    ['comparison', 'CP', 'Compare locations'], ['geography', 'MP', 'Spatial analysis'],
    ['alerts', 'AL', 'Alert intelligence'], ['operations-queue', 'OQ', 'Operations queue'], ['ebs', 'WF', 'Response workflow'],
    ['ebs-registry', 'RG', 'Signal registry'],
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark">OH</div><div><strong>OneHealth</strong><small>Intelligence Platform</small></div></div>
        <div className="workspace-switch"><span>National workspace</span><strong>Bangladesh · {diseaseName}</strong><small>Operational surveillance</small></div>
        <nav aria-label="Primary navigation">
          <p>Intelligence workspace</p>
          {navigation.map(([target, icon, label]) => <a className={activeNav === target ? 'active' : ''} key={target} href={`#${target}`} onClick={() => setActiveNav(target)}><span>{icon}</span>{label}{target === 'alerts' && highRiskCount > 0 ? <b>{highRiskCount}</b> : null}</a>)}
        </nav>
        <div className="sidebar-status"><span /><div><strong>DHIS2 connected</strong><small>Aggregate + Tracker API</small></div></div>
      </aside>

      <main id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">National surveillance command centre</p>
            <h1>{diseaseName} intelligence</h1>
            <p>{historicalOnly ? 'Historical evidence, geographic burden and research intelligence' : 'Early warning, spatial risk and coordinated response'} · {latestPeriod}</p>
          </div>
          <div className="topbar-actions"><label className="location-select disease-select">
            <span>Disease programme</span>
            <select value={selectedDisease} onChange={(event) => setSelectedDisease(event.target.value)}>
              {diseases.map((disease) => <option key={disease.code} value={disease.code}>{disease.name}</option>)}
            </select>
          </label><label className="location-select">
            <span>Reporting location</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {locations.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}
            </select>
          </label><SessionControl /></div>
        </header>

        {error && <div className="error-banner" role="alert">Could not load surveillance data: {error}</div>}
        {loading ? <div className="loading-state">Loading {selectedLocation?.name ?? 'surveillance'} data…</div> : (
          <>
            <div className="geo-grid hero-geo" id="geography">
              <RiskMap items={overview} selected={selected} diseaseName={diseaseName} metricLabel={metricLabel} onSelect={setSelected} />
              <LocationTable items={overview} selected={selected} onSelect={setSelected} />
            </div>
            <SummaryCards summary={selectedSummary} alert={alert} metricLabel={metricLabel} periodLabel={periodLabel} diseaseCode={selectedDisease} />
            <div className="dashboard-grid" id="surveillance">
              <TrendChart records={trend} alert={alert} diseaseName={diseaseName} metricLabel={metricLabel} periodLabel={periodLabel} historicalOnly={historicalOnly} />
              <div id="alerts"><AlertPanel alert={alert} /></div>
            </div>
            {locations.length > 1 && <ComparisonWorkbench diseaseCode={selectedDisease} locations={locations} primaryCode={selected} primaryRecords={trend} metricLabel={metricLabel} />}
            <EBSOperationsQueue />
            <EBSWorkspace locations={locations} />
            <EBSSignalRegistry />
          </>
        )}
      </main>
    </div>
  )
}
