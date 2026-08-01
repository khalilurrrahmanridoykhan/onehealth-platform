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

export function RiskMap({ items, selected, onSelect }: Props) {
  const [geoData, setGeoData] = useState<FeatureCollection<Geometry, DivisionProperties>>()
  const summaries = useMemo(
    () => new Map(items.map((item) => [item.location_code, item])),
    [items],
  )

  useEffect(() => {
    fetch('/bangladesh_divisions.geojson')
      .then((response) => response.json())
      .then((data: FeatureCollection<Geometry, DivisionProperties>) => setGeoData(data))
  }, [])

  const map = useMemo(() => {
    if (!geoData) return null
    const projection = geoMercator().fitSize([500, 455], geoData)
    return { path: geoPath(projection) }
  }, [geoData])

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Spatial risk</p>
          <h2>Bangladesh division map</h2>
        </div>
        <div className="map-legend"><span className="low" />Low <span className="medium" />Medium <span className="high" />High</div>
      </div>
      {!geoData || !map ? <div className="map-loading">Loading boundaries…</div> : (
        <svg className="risk-map" viewBox="0 0 500 455" role="img" aria-label="Dengue risk by Bangladesh division">
          {geoData.features.map((feature) => {
            const locationCode = ISO_TO_LOCATION[feature.properties.shapeISO]
            const summary = summaries.get(locationCode)
            const risk = summary?.risk_level ?? 'UNKNOWN'
            const centroid = map.path.centroid(feature)
            return (
              <g key={feature.properties.shapeISO}>
                <path
                  d={map.path(feature) ?? undefined}
                  fill={RISK_COLOR[risk]}
                  className={selected === locationCode ? 'map-shape selected' : 'map-shape'}
                  onClick={() => onSelect(locationCode)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${summary?.location_name ?? feature.properties.shapeName}: ${risk} risk`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelect(locationCode)
                  }}
                >
                  <title>{summary?.location_name ?? feature.properties.shapeName}: {risk} risk, {summary?.latest_cases ?? 0} latest cases</title>
                </path>
                <text x={centroid[0]} y={centroid[1]} className="map-label">{summary?.location_name ?? feature.properties.shapeName}</text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}

