import { geoMercator, geoPath } from 'd3-geo'
import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'
import type { OverviewItem, RiskLevel } from '../types'

interface DivisionProperties {
  shapeISO: string
  shapeName: string
}

interface Props {
  items: OverviewItem[]
  selected: string
  diseaseName: string
  metricLabel: string
  onSelect: (code: string) => void
}

const ISO_TO_LOCATION: Record<string, string> = {
  'BD-A': 'BD-BAR',
  'BD-B': 'BD-CTG',
  'BD-C': 'BD-DHA',
  'BD-D': 'BD-KHU',
  'BD-E': 'BD-RAJ',
  'BD-F': 'BD-RAN',
  'BD-G': 'BD-SYL',
  'BD-H': 'BD-MYM',
}

const RISK_COLOR: Record<RiskLevel | 'UNKNOWN', string> = {
  LOW: '#80d5b3',
  MEDIUM: '#f4c95d',
  HIGH: '#e97870',
  UNKNOWN: '#d7e2de',
}

export function RiskMap({ items, selected, diseaseName, metricLabel, onSelect }: Props) {
  const [geoData, setGeoData] = useState<FeatureCollection<Geometry, DivisionProperties>>()
  const [layer, setLayer] = useState<'risk' | 'cases' | 'total' | 'deviation'>('risk')
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const summaries = useMemo(
    () => new Map(items.map((item) => [item.location_code, item])),
    [items],
  )

  useEffect(() => {
    fetch('/bangladesh_divisions.geojson')
      .then((response) => response.json())
      .then((data: FeatureCollection<Geometry, DivisionProperties>) => setGeoData(data))
  }, [])

  useEffect(() => {
    setLayer(diseaseName.includes('HPAI') || diseaseName.includes('Nipah') ? 'total' : diseaseName === 'Measles' ? 'cases' : 'risk')
  }, [diseaseName])

  const map = useMemo(() => {
    if (!geoData) return null
    const projection = geoMercator().fitSize([500, 455], geoData)
    return { path: geoPath(projection) }
  }, [geoData])
  const divisions = items.filter((item) => item.location_level === 'division')
  const maximumCases = Math.max(...divisions.map((item) => item.latest_cases), 1)
  const maximumTotal = Math.max(...divisions.map((item) => item.total_cases), 1)
  const selectedSummary = summaries.get(selected)

  const fillFor = (summary?: OverviewItem) => {
    if (!summary) return RISK_COLOR.UNKNOWN
    if (layer === 'risk') return RISK_COLOR[summary.risk_level ?? 'UNKNOWN']
    if (layer === 'cases') {
      const intensity = Math.max(.12, summary.latest_cases / maximumCases)
      return `color-mix(in srgb, #b42318 ${Math.round(intensity * 88)}%, #fff)`
    }
    if (layer === 'total') {
      const intensity = Math.max(.12, summary.total_cases / maximumTotal)
      return `color-mix(in srgb, #7f1d1d ${Math.round(intensity * 88)}%, #fff)`
    }
    const deviation = summary.expected_cases ? (summary.latest_cases - summary.expected_cases) / summary.expected_cases : 0
    if (deviation > .5) return '#dc5f58'
    if (deviation > .2) return '#f4c95d'
    return '#80d5b3'
  }

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Spatial risk</p>
          <h2>Bangladesh division map</h2>
        </div>
        <div className="map-controls"><label className="map-layer">Map layer<select value={layer} onChange={(event) => setLayer(event.target.value as typeof layer)}><option value="risk">Alert risk</option><option value="cases">Latest {metricLabel}</option><option value="total">Historical outbreak burden</option><option value="deviation">Baseline deviation</option></select></label><div className="map-tool-buttons" aria-label="Map display controls"><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .2))} aria-label="Zoom in">+</button><button type="button" onClick={() => setZoom((value) => Math.max(1, value - .2))} aria-label="Zoom out">−</button><button type="button" className={showLabels ? 'active' : ''} onClick={() => setShowLabels((value) => !value)} aria-label="Toggle division labels">Aa</button><button type="button" onClick={() => { setZoom(1); setShowLabels(true) }} aria-label="Reset map">Reset</button></div></div>
      </div>
      {!geoData || !map ? <div className="map-loading">Loading boundaries…</div> : (
        <svg className="risk-map" viewBox="0 0 500 455" role="img" aria-label={`${diseaseName} risk by Bangladesh division`}>
          <rect className="map-ocean" width="500" height="455" rx="14" />
          <g transform={`translate(250 227.5) scale(${zoom}) translate(-250 -227.5)`}>
          {geoData.features.map((feature) => {
            const locationCode = ISO_TO_LOCATION[feature.properties.shapeISO]
            const summary = summaries.get(locationCode)
            const risk = summary?.risk_level ?? 'UNKNOWN'
            const centroid = map.path.centroid(feature)
            return (
              <g key={feature.properties.shapeISO}>
                <path
                  d={map.path(feature) ?? undefined}
                  fill={fillFor(summary)}
                  className={selected === locationCode ? 'map-shape selected' : 'map-shape'}
                  onClick={() => { if (summary) onSelect(locationCode) }}
                  tabIndex={summary ? 0 : -1}
                  role={summary ? 'button' : 'img'}
                  aria-label={`${summary?.location_name ?? feature.properties.shapeName}: ${risk} risk`}
                  onKeyDown={(event) => {
                    if (summary && (event.key === 'Enter' || event.key === ' ')) onSelect(locationCode)
                  }}
                >
                  <title>{summary?.location_name ?? feature.properties.shapeName}: {risk} risk, {summary?.latest_cases ?? 0} latest {metricLabel}</title>
                </path>
                {showLabels && <text x={centroid[0]} y={centroid[1]} className="map-label">{summary?.location_name ?? feature.properties.shapeName}</text>}
              </g>
            )
          })}
          </g>
        </svg>
      )}
      <div className="map-footer">
        <div className="map-legend">{layer === 'cases' || layer === 'total' ? `${layer === 'total' ? 'Historical burden' : metricLabel} · light to dark` : <><span className="low" />Low <span className="medium" />Watch <span className="high" />High</>}</div>
        <div className="map-selection"><span>Selected area</span><strong>{selectedSummary?.location_name ?? 'Select a division'}</strong><small>{selectedSummary ? `${selectedSummary.latest_cases.toLocaleString()} ${metricLabel} · ${selectedSummary.risk_level ?? 'Unknown'} risk` : 'Click a boundary to inspect'}</small></div>
      </div>
    </section>
  )
}
