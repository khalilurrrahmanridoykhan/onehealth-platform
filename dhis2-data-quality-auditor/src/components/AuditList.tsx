import { Button, CircularLoader, Menu, MenuItem } from '@dhis2/ui'
import { useAuditReports } from '../context/AuditReportsContext'
import type { AuditConfig } from '../types/audit'
import { QualityTag } from './StatusTag'

interface RowProps {
  audit: AuditConfig
  active: boolean
  onSelect: () => void
}

// Reads status from the shared AuditReportsContext instead of calling a
// per-audit fetch hook itself -- the fix for the N+1 pattern confirmed in the
// original app, where every ProgrammeList row independently fetched its own
// programme's report.
function AuditRow({ audit, active, onSelect }: RowProps) {
  const { reportsByAuditId } = useAuditReports()
  const state = reportsByAuditId[audit.id]
  return (
    <MenuItem
      label={audit.name}
      active={active}
      onClick={onSelect}
      suffix={state?.loading ? <CircularLoader small /> : state?.report ? <QualityTag status={state.report.quality.status} /> : null}
    />
  )
}

export function AuditList({
  audits,
  selectedId,
  onSelect,
  canManage,
  onAddAudit,
}: {
  audits: AuditConfig[]
  selectedId: string | null
  onSelect: (id: string) => void
  canManage: boolean
  onAddAudit: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {canManage && (
        <div style={{ padding: 12 }}>
          <Button small primary onClick={onAddAudit}>
            Add audit
          </Button>
        </div>
      )}
      <Menu>
        {audits.map((audit) => (
          <AuditRow key={audit.id} audit={audit} active={audit.id === selectedId} onSelect={() => onSelect(audit.id)} />
        ))}
      </Menu>
    </div>
  )
}
