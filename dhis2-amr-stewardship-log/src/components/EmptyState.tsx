import { Button } from '@dhis2/ui'

// Shown on a fresh install before any admin has configured a formulary/org
// units yet -- this app never ships with bundled antibiotic or AWaRe data
// (see README), so there is always a real "nothing configured" state.
export function EmptyState({ canManage, onConfigure }: { canManage: boolean; onConfigure: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}>
      <h2 style={{ margin: 0 }}>Not configured yet</h2>
      <p style={{ margin: 0, color: '#6e7a89', maxWidth: 480 }}>
        This checklist needs a facility formulary (antibiotic names and their WHO AWaRe category) and at least one org unit
        before anyone can log a prescribing entry. Nothing is bundled -- an admin defines the formulary from scratch.
      </p>
      {canManage ? (
        <Button primary onClick={onConfigure}>
          Configure Stewardship
        </Button>
      ) : (
        <p style={{ margin: 0, color: '#6e7a89', fontStyle: 'italic' }}>
          Ask an admin (superuser, or app-management authority) to configure it.
        </p>
      )}
    </div>
  )
}
