import { AlertBar, CircularLoader, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import { AuditDetail } from './components/AuditDetail'
import { AuditForm } from './components/AuditForm'
import { AuditList } from './components/AuditList'
import { EmptyState } from './components/EmptyState'
import { AuditReportsProvider } from './context/AuditReportsContext'
import { useAudits } from './hooks/useAudits'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import type { AuditConfig } from './types/audit'

export default function App() {
  const { loading, error, audits, saveAudit, deleteAudit } = useAudits()
  const { canManage, username } = useCurrentUserAuthorities()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formState, setFormState] = useState<{ open: boolean; audit: AuditConfig | null }>({ open: false, audit: null })
  const [saveError, setSaveError] = useState<string | null>(null)

  const selected = audits.find((a) => a.id === selectedId) ?? audits[0] ?? null

  function openAddForm() {
    setFormState({ open: true, audit: null })
  }

  function openEditForm(audit: AuditConfig) {
    setFormState({ open: true, audit })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this audit? This cannot be undone.')) return
    try {
      await deleteAudit(id)
      if (selectedId === id) setSelectedId(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      {saveError && (
        <AlertBar critical onHidden={() => setSaveError(null)}>
          {`Could not save: ${saveError}`}
        </AlertBar>
      )}
      {/* Wraps both the sidebar and the detail pane so AuditList's status
          tags and AuditDetail's full report read from the same shared fetch
          queue -- never N independent fetches for N audits. */}
      <AuditReportsProvider audits={audits}>
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 48px)' }}>
          <aside style={{ width: 280, flexShrink: 0, borderRight: '1px solid #e0e0e0' }}>
            {!loading && !error && (
              <AuditList
                audits={audits}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                canManage={canManage}
                onAddAudit={openAddForm}
              />
            )}
          </aside>
          <main style={{ flex: 1, padding: 24, maxWidth: 1100 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <CircularLoader />
              </div>
            ) : error ? (
              <NoticeBox error title="Could not load configured audits">
                {error}
              </NoticeBox>
            ) : audits.length === 0 ? (
              <EmptyState canManage={canManage} onAddAudit={openAddForm} />
            ) : selected ? (
              <AuditDetail
                audit={selected}
                canManage={canManage}
                onEdit={() => openEditForm(selected)}
                onDelete={() => handleDelete(selected.id)}
              />
            ) : null}
          </main>
        </div>
      </AuditReportsProvider>

      {formState.open && (
        <AuditForm
          audit={formState.audit}
          currentUsername={username}
          onClose={() => setFormState({ open: false, audit: null })}
          onSave={async (audit) => {
            await saveAudit(audit)
            setSelectedId(audit.id)
          }}
        />
      )}
    </>
  )
}
