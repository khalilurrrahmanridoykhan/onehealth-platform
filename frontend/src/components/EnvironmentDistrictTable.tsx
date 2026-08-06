import { useState } from 'react'
import type { EnvironmentDistrict } from '../types'

interface Props {
  items: EnvironmentDistrict[]
  selected: string
  onSelect: (code: string) => void
}

type SortKey = 'location_name' | 'mean_temp_c' | 'mean_annual_precip_mm' | 'mean_annual_extreme_heat_days'

const number = new Intl.NumberFormat('en-US')
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function EnvironmentDistrictTable({ items, selected, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('mean_annual_extreme_heat_days')
  const [descending, setDescending] = useState(true)

  const sorted = [...items].sort((a, b) => {
    const direction = descending ? -1 : 1
    if (sortKey === 'location_name') return direction * a.location_name.localeCompare(b.location_name)
    return direction * (a[sortKey] - b[sortKey])
  })

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDescending((value) => !value)
    else { setSortKey(key); setDescending(true) }
  }

  const headers: Array<[SortKey, string]> = [
    ['location_name', 'District'],
    ['mean_temp_c', 'Mean temp (°C)'],
    ['mean_annual_precip_mm', 'Annual precip (mm)'],
    ['mean_annual_extreme_heat_days', 'Extreme-heat days/yr'],
  ]

  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Geographic comparison</p>
          <h2>District climate overview</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map(([key, label]) => (
                <th key={key}>
                  <button type="button" onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`}>
                    {label}{sortKey === key ? (descending ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr
                key={item.location_code}
                className={selected === item.location_code ? 'selected-row' : ''}
                onClick={() => onSelect(item.location_code)}
              >
                <td><button type="button" onClick={() => onSelect(item.location_code)}>{item.location_name}</button></td>
                <td>{decimal.format(item.mean_temp_c)}</td>
                <td>{number.format(Math.round(item.mean_annual_precip_mm))}</td>
                <td>{decimal.format(item.mean_annual_extreme_heat_days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
