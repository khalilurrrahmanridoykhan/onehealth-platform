import type { OverviewItem } from '../types'
import { RiskBadge } from './RiskBadge'

interface Props {
  items: OverviewItem[]
  selected: string
  onSelect: (code: string) => void
}

const number = new Intl.NumberFormat('en-US')

export function LocationTable({ items, selected, onSelect }: Props) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Geographic comparison</p>
          <h2>Division surveillance overview</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Location</th><th>Latest</th><th>Expected</th><th>Total</th><th>Risk</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.location_code}
                className={selected === item.location_code ? 'selected-row' : ''}
                onClick={() => onSelect(item.location_code)}
              >
                <td><button type="button" onClick={() => onSelect(item.location_code)}>{item.location_name}</button></td>
                <td>{number.format(item.latest_cases)}<small className="table-period">{item.latest_period}</small></td>
                <td>{item.expected_cases === null ? '—' : number.format(Math.round(item.expected_cases))}</td>
                <td>{number.format(item.total_cases)}</td>
                <td><RiskBadge level={item.risk_level} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
