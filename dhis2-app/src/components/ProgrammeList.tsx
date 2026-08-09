import { CircularLoader, Menu, MenuItem } from '@dhis2/ui'
import { PROGRAMMES } from '../config/programmes'
import { useProgrammeDataTrust } from '../hooks/useProgrammeDataTrust'
import { QualityTag } from './StatusTag'

interface RowProps {
  code: string
  name: string
  active: boolean
  onSelect: () => void
}

function ProgrammeRow({ code, name, active, onSelect }: RowProps) {
  const programme = PROGRAMMES.find((p) => p.code === code)!
  const { loading, report } = useProgrammeDataTrust(programme)
  return (
    <MenuItem
      label={name}
      active={active}
      onClick={onSelect}
      suffix={loading ? <CircularLoader small /> : report ? <QualityTag status={report.quality.status} /> : null}
    />
  )
}

export function ProgrammeList({ selected, onSelect }: { selected: string; onSelect: (code: string) => void }) {
  return (
    <Menu>
      {PROGRAMMES.map((programme) => (
        <ProgrammeRow
          key={programme.code}
          code={programme.code}
          name={programme.name}
          active={programme.code === selected}
          onSelect={() => onSelect(programme.code)}
        />
      ))}
    </Menu>
  )
}
