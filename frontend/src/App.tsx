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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">OH</div>
        <nav aria-label="Primary navigation">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#surveillance">Surveillance</a>
          <a href="#alerts">Alerts</a>
          <a href="#comparison">Compare</a>
          <a href="#ebs">EBS workflow</a>
          <a href="#ebs-registry">Signal registry</a>
        </nav>
        <div className="sidebar-status"><span /> Data source configurable<br /><small>CSV or DHIS2</small></div>
      </aside>

      <main id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">OneHealth Intelligence Platform</p>
            <h1>Dengue surveillance</h1>
            <p>Early-warning intelligence for Bangladesh</p>
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
            <SummaryCards summary={selectedSummary} alert={alert} />
            <div className="dashboard-grid" id="surveillance">
              <TrendChart records={trend} alert={alert} />
              <div id="alerts"><AlertPanel alert={alert} /></div>
            </div>
            <ComparisonWorkbench locations={locations} primaryCode={selected} primaryRecords={trend} />
            <div className="geo-grid">
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
