import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { AlertPanel } from './components/AlertPanel'
import { ComparisonWorkbench } from './components/ComparisonWorkbench'
import { EBSWorkspace } from './components/EBSWorkspace'
import { EBSSignalRegistry } from './components/EBSSignalRegistry'
import { LocationTable } from './components/LocationTable'
import { RiskMap } from './components/RiskMap'
import { SummaryCards } from './components/SummaryCards'
import { SessionControl } from './components/SessionControl'
import { TrendChart } from './components/TrendChart'
import type { Alert, Location, OverviewItem, SurveillanceRecord } from './types'

export default function App() {
  const [locations, setLocations] = useState<Location[]>([])
  const [overview, setOverview] = useState<OverviewItem[]>([])
  const [selected, setSelected] = useState('BD')
  const [trend, setTrend] = useState<SurveillanceRecord[]>([])
  const [alert, setAlert] = useState<Alert>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [activeNav, setActiveNav] = useState('dashboard')

  useEffect(() => {
    Promise.all([api.locations(), api.overview()])
      .then(([locationData, overviewData]) => {
        setLocations(locationData)
        setOverview(overviewData)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(undefined)
    Promise.all([api.trend(selected), api.alert(selected)])
      .then(([trendData, alertData]) => {
        setTrend(trendData)
        setAlert(alertData)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [selected])

  const selectedLocation = locations.find((location) => location.code === selected)
  const selectedSummary = useMemo(
    () => overview.find((item) => item.location_code === selected),
    [overview, selected],
  )
  const divisionOverview = overview.filter((item) => item.location_level === 'division')
  const highRiskCount = divisionOverview.filter((item) => item.risk_level === 'HIGH').length
  const aboveBaselineCount = divisionOverview.filter((item) => item.expected_cases !== null && item.latest_cases > item.expected_cases).length
  const latestPeriod = overview.find((item) => item.location_code === 'BD')?.latest_period ?? 'Waiting for data'

  const navigation = [
    ['dashboard', 'OV', 'Command overview'], ['surveillance', 'TR', 'Trends & forecast'],
    ['comparison', 'CP', 'Compare locations'], ['geography', 'MP', 'Spatial analysis'],
    ['alerts', 'AL', 'Alert intelligence'], ['ebs', 'WF', 'Response workflow'],
    ['ebs-registry', 'RG', 'Signal registry'],
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark">OH</div><div><strong>OneHealth</strong><small>Intelligence Platform</small></div></div>
        <div className="workspace-switch"><span>National workspace</span><strong>Bangladesh · Dengue</strong><small>Operational surveillance</small></div>
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
            <h1>Dengue intelligence</h1>
            <p>Early warning, spatial risk and coordinated response · {latestPeriod}</p>
          </div>
          <div className="topbar-actions"><label className="location-select">
            <span>Reporting location</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {locations.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}
            </select>
          </label><SessionControl /></div>
        </header>

        {error && <div className="error-banner" role="alert">Could not load surveillance data: {error}</div>}
        {loading ? <div className="loading-state">Loading {selectedLocation?.name ?? 'surveillance'} data…</div> : (
          <>
            <section className="operations-bar" aria-label="Operational status">
              <div><span className="status-live" />System status<strong>Live from DHIS2</strong></div>
              <div><span>High-risk divisions</span><strong>{highRiskCount}</strong><small>require verification</small></div>
              <div><span>Above baseline</span><strong>{aboveBaselineCount}</strong><small>of 8 divisions</small></div>
              <div><span>Latest reporting period</span><strong>{latestPeriod}</strong><small>complete weekly data</small></div>
            </section>
            <SummaryCards summary={selectedSummary} alert={alert} />
            <div className="dashboard-grid" id="surveillance">
              <TrendChart records={trend} alert={alert} />
              <div id="alerts"><AlertPanel alert={alert} /></div>
            </div>
            <ComparisonWorkbench locations={locations} primaryCode={selected} primaryRecords={trend} />
            <div className="geo-grid" id="geography">
              <RiskMap items={overview} selected={selected} onSelect={setSelected} />
              <LocationTable items={overview} selected={selected} onSelect={setSelected} />
            </div>
            <EBSWorkspace locations={locations} />
            <EBSSignalRegistry />
          </>
        )}
      </main>
    </div>
  )
}
