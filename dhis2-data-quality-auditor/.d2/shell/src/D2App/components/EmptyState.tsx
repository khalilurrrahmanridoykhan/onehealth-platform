import { Button } from '@dhis2/ui'

// Shown on a fresh install with zero configured audits -- OneHealth Data
// Trust never needed this, it always shipped with 8 preloaded programmes.
// Data Quality Auditor starts with none: `audits` is an empty array until an
// admin creates the first one.
export function EmptyState({ canManage, onAddAudit }: { canManage: boolean; onAddAudit: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}>
      <h2 style={{ margin: 0 }}>No audits configured yet</h2>
      <p style={{ margin: 0, color: '#6e7a89', maxWidth: 480 }}>
        An audit points this app at one dataset and data element on this instance and checks its coverage, freshness, and
        plausibility. Nothing is bundled or pre-configured -- pick your own data to get started.
      </p>
      {canManage ? (
        <Button primary onClick={onAddAudit}>
          Add your first audit
        </Button>
      ) : (
        <p style={{ margin: 0, color: '#6e7a89', fontStyle: 'italic' }}>
          Ask a user with superuser (ALL) authority to add one.
        </p>
      )}
    </div>
  )
}
