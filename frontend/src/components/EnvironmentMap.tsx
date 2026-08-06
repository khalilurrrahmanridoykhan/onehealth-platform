import { geoMercator, geoPath } from 'd3-geo'
import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'
import type { EnvironmentDistrict } from '../types'

interface DistrictProperties {
  location_code: string
  district_name: string
  division_code: string
  division_name: string
}

interface Props {
  items: EnvironmentDistrict[]
  selected: string
  onSelect: (code: string) => void
}

type Metric = 'mean_temp_c' | 'mean_annual_precip_mm' | 'mean_annual_extreme_heat_days'

const METRIC_LABEL: Record<Metric, string> = {
  mean_temp_c: 'Mean temperature',
  mean_annual_precip_mm: 'Annual precipitation',
  mean_annual_extreme_heat_days: 'Extreme-heat days/year',
}

const METRIC_COLOR: Record<Metric, string> = {
  mean_temp_c: '#b42318',
  mean_annual_precip_mm: '#1d4ed8',
  mean_annual_extreme_heat_days: '#c2410c',
}

export function EnvironmentMap({ items, selected, onSelect }: Props) {
  const [geoData, setGeoData] = useState<FeatureCollection<Geometry, DistrictProperties>>()
  const [metric, setMetric] = useState<Metric>('mean_annual_extreme_heat_days')
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(false)
  const districts = useMemo(
    () => new Map(items.map((item) => [item.location_code, item])),
    [items],
  )

  useEffect(() => {
    fetch('/bangladesh_districts.geojson')
      .then((response) => response.json())
      .then((data: FeatureCollection<Geometry, DistrictProperties>) => setGeoData(data))
  }, [])

  const map = useMemo(() => {
    if (!geoData) return null
    const projection = geoMercator().fitSize([500, 455], geoData)
    return { path: geoPath(projection) }
  }, [geoData])

  const values = items.map((item) => item[metric])
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 1
  const selectedDistrict = districts.get(selected)

  const fillFor = (district?: EnvironmentDistrict) => {
    if (!district) return '#d7e2de'
    const range = maximum - minimum || 1
    const intensity = Math.max(.12, (district[metric] - minimum) / range)
    return `color-mix(in srgb, ${METRIC_COLOR[metric]} ${Math.round(intensity * 88)}%, #fff)`
  }

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Climate overlay</p>
          <h2>Bangladesh district climate map</h2>
        </div>
        <div className="map-controls">
          <label className="map-layer">
            Map layer
            <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
              <option value="mean_annual_extreme_heat_days">Extreme-heat days/year</option>
              <option value="mean_temp_c">Mean temperature</option>
              <option value="mean_annual_precip_mm">Annual precipitation</option>
            </select>
          </label>
          <div className="map-tool-buttons" aria-label="Map display controls">
            <button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .2))} aria-label="Zoom in on district map">+</button>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - .2))} aria-label="Zoom out on district map">−</button>
            <button type="button" className={showLabels ? 'active' : ''} onClick={() => setShowLabels((value) => !value)} aria-label="Toggle district labels">Aa</button>
            <button type="button" onClick={() => { setZoom(1); setShowLabels(false) }} aria-label="Reset district map">Reset</button>
          </div>
        </div>
      </div>
      {!geoData || !map ? <div className="map-loading">Loading boundaries…</div> : (
        <svg className="risk-map" viewBox="0 0 500 455" role="img" aria-label={`${METRIC_LABEL[metric]} by Bangladesh district`}>
          <rect className="map-ocean" width="500" height="455" rx="14" />
          <g transform={`translate(250 227.5) scale(${zoom}) translate(-250 -227.5)`}>
            {geoData.features.map((feature) => {
              const locationCode = feature.properties.location_code
              const district = districts.get(locationCode)
              const centroid = map.path.centroid(feature)
              return (
                <g key={locationCode}>
                  <path
                    d={map.path(feature) ?? undefined}
                    fill={fillFor(district)}
                    className={selected === locationCode ? 'map-shape selected' : 'map-shape'}
                    onClick={() => { if (district) onSelect(locationCode) }}
                    tabIndex={district ? 0 : -1}
                    role={district ? 'button' : 'img'}
                    aria-label={`${district?.location_name ?? feature.properties.district_name}: ${METRIC_LABEL[metric]}`}
                    onKeyDown={(event) => {
                      if (district && (event.key === 'Enter' || event.key === ' ')) onSelect(locationCode)
                    }}
                  >
                    <title>{district?.location_name ?? feature.properties.district_name}</title>
                  </path>
                  {showLabels && <text x={centroid[0]} y={centroid[1]} className="map-label">{district?.location_name ?? feature.properties.district_name}</text>}
                </g>
              )
            })}
          </g>
        </svg>
      )}
      <div className="map-footer">
        <div className="map-legend">{METRIC_LABEL[metric]} · light to dark</div>
        <div className="map-selection">
          <span>Selected district</span>
          <strong>{selectedDistrict?.location_name ?? 'Select a district'}</strong>
          <small>{selectedDistrict ? `${selectedDistrict.mean_temp_c.toFixed(1)} °C mean · ${selectedDistrict.mean_annual_extreme_heat_days.toFixed(1)} extreme-heat days/yr` : 'Click a boundary to inspect'}</small>
        </div>
      </div>
    </section>
  )
}
