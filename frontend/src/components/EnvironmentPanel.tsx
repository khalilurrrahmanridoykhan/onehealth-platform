import { useEffect, useState } from 'react'
import { api } from '../api'
import type { EnvironmentDistrict, EnvironmentMonthlyRecord } from '../types'
import { CorrelationPanel } from './CorrelationPanel'
import { EnvironmentDistrictTable } from './EnvironmentDistrictTable'
import { EnvironmentMap } from './EnvironmentMap'
import { EnvironmentTrendChart } from './EnvironmentTrendChart'
import { EnvironmentTrustPanel } from './EnvironmentTrustPanel'

export function EnvironmentPanel() {
  const [districts, setDistricts] = useState<EnvironmentDistrict[]>([])
  const [selected, setSelected] = useState('BD-D-DHAKA')
  const [monthly, setMonthly] = useState<EnvironmentMonthlyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    setLoading(true)
    setError(undefined)
    api.environmentDistricts()
      .then(setDistricts)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.environmentMonthly(selected, 60)
      .then(setMonthly)
      .catch((reason: Error) => setError(reason.message))
  }, [selected])

  const selectedDistrict = districts.find((district) => district.location_code === selected)

  return (
    <section id="environment" className="environment-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">One Health</p>
          <h2>Climate &amp; environment overlay</h2>
          <p className="data-trust-intro">District-level temperature, rainfall and extreme-heat observations, plus an exploratory AWD-climate correlation analysis below — data visualization and exploratory statistics, not operational forecasting.</p>
        </div>
      </div>
      {error && <div className="error-banner" role="alert">Could not load environment data: {error}</div>}
      {loading ? <div className="loading-state">Loading district climate data…</div> : (
        <>
          <div className="geo-grid hero-geo">
            <EnvironmentMap items={districts} selected={selected} onSelect={setSelected} />
            <EnvironmentDistrictTable items={districts} selected={selected} onSelect={setSelected} />
          </div>
          <div className="dashboard-grid">
            <EnvironmentTrendChart records={monthly} districtName={selectedDistrict?.location_name ?? 'Selected district'} />
          </div>
          <EnvironmentTrustPanel />
          <CorrelationPanel />
        </>
      )}
    </section>
  )
}
