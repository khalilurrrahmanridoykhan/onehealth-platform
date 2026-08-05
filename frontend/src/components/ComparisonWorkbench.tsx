import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import type { Location, SurveillanceRecord } from '../types'

interface Props {
  diseaseCode: string
  locations: Location[]
  primaryCode: string
  primaryRecords: SurveillanceRecord[]
  metricLabel: string
}

const number = new Intl.NumberFormat('en-US')

export function ComparisonWorkbench({ diseaseCode, locations, primaryCode, primaryRecords, metricLabel }: Props) {
  const alternatives = locations.filter((location) => location.code !== primaryCode)
  const [comparisonCode, setComparisonCode] = useState('')
  const [comparisonRecords, setComparisonRecords] = useState<SurveillanceRecord[]>([])
  const [windowSize, setWindowSize] = useState(12)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const fallback = alternatives.find((location) => location.level === 'division')?.code ?? alternatives[0]?.code ?? ''
    if (!comparisonCode || comparisonCode === primaryCode) setComparisonCode(fallback)
  }, [primaryCode, locations]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!comparisonCode) return
    setError(undefined)
    api.trend(diseaseCode, comparisonCode).then(setComparisonRecords).catch((reason: Error) => setError(reason.message))
  }, [diseaseCode, comparisonCode])

  const data = useMemo(() => {
    const primary = primaryRecords.slice(-windowSize)
    const comparison = new Map(comparisonRecords.slice(-windowSize).map((record) => [record.period_label, record.cases]))
    return primary.map((record) => ({
      period: record.period_label.replace(/^\d{4}-/, ''),
      primary: record.cases,
      comparison: comparison.get(record.period_label) ?? null,
    }))
  }, [primaryRecords, comparisonRecords, windowSize])

  const primaryName = locations.find((location) => location.code === primaryCode)?.name ?? primaryCode
  const comparisonName = locations.find((location) => location.code === comparisonCode)?.name ?? comparisonCode
  const primaryTotal = data.reduce((sum, item) => sum + item.primary, 0)
  const comparisonTotal = data.reduce((sum, item) => sum + (item.comparison ?? 0), 0)
  const difference = comparisonTotal ? ((primaryTotal - comparisonTotal) / comparisonTotal) * 100 : null

  return (
    <section className="panel comparison-panel" id="comparison">
      <div className="panel-heading comparison-heading">
        <div><p className="eyebrow">Comparison intelligence</p><h2>Location and reporting-window analysis</h2></div>
        <div className="comparison-filters">
          <label>Compare with<select value={comparisonCode} onChange={(event) => setComparisonCode(event.target.value)}>{alternatives.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}</select></label>
          <label>Window<select value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value))}><option value={4}>4 periods</option><option value={8}>8 periods</option><option value={12}>12 periods</option><option value={21}>All available</option></select></label>
        </div>
      </div>
      {error ? <p className="comparison-error">Could not load comparison: {error}</p> : <>
        <div className="comparison-kpis">
          <div><span>{primaryName}</span><strong>{number.format(primaryTotal)}</strong><small>{metricLabel} in selected window</small></div>
          <div><span>{comparisonName}</span><strong>{number.format(comparisonTotal)}</strong><small>{metricLabel} in selected window</small></div>
          <div><span>Relative difference</span><strong className={difference !== null && difference > 0 ? 'text-alert' : 'text-stable'}>{difference === null ? '—' : `${difference > 0 ? '+' : ''}${difference.toFixed(1)}%`}</strong><small>{primaryName} versus {comparisonName}</small></div>
        </div>
        <div className="comparison-chart" aria-label={`${primaryName} and ${comparisonName} trend comparison`}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 20, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#dce8e3" />
            <XAxis dataKey="period" tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dce8e3' }} /><Legend />
            <Line name={primaryName} type="monotone" dataKey="primary" stroke="#087f5b" strokeWidth={3} dot={false} />
            <Line name={comparisonName} type="monotone" dataKey="comparison" stroke="#2563a5" strokeWidth={3} dot={false} />
          </LineChart></ResponsiveContainer>
        </div>
      </>}
    </section>
  )
}
