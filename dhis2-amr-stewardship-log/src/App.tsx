import { CircularLoader, HeaderBar, NoticeBox, Tab, TabBar } from '@dhis2/ui'
import { useState } from 'react'
import { ApprovalForm } from './components/ApprovalForm'
import { ComplianceSummary } from './components/ComplianceSummary'
import { DurationForm } from './components/DurationForm'
import { EmptyState } from './components/EmptyState'
import { EntryList } from './components/EntryList'
import { FollowUpForm } from './components/FollowUpForm'
import { PrescribingForm } from './components/PrescribingForm'
import { SetupPanel } from './components/SetupPanel'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useRecentEntries } from './hooks/useRecentEntries'
import { useStewardshipSettings } from './hooks/useStewardshipSettings'
import { supportsApproval, supportsDuration, supportsFollowUp } from './types/stewardship'

type ViewTab = 'log' | 'summary' | 'configure'

// A single entry can need a follow-up (Empiric), a review (Reserve), and a
// stop-date record all at once -- e.g. empiric vancomycin -- so a bare
// selected-id isn't enough to know which form to render; the action kind
// disambiguates.
type SelectedAction = { kind: 'followUp' | 'approval' | 'duration'; eventId: string } | null

export default function App() {
  const { loading, error, settings, save } = useStewardshipSettings()
  const { canManage, userGroupIds, username } = useCurrentUserAuthorities()
  const { entries, refresh: refreshEntries } = useRecentEntries(settings)
  const [tab, setTab] = useState<ViewTab>('log')
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null)

  const selectedEntry = selectedAction ? (entries.find((e) => e.eventId === selectedAction.eventId) ?? null) : null

  // Fails closed: no reviewer group configured yet means canReview is false
  // for everyone, including canManage admins -- approving is a distinct
  // capability from configuring, same as this app's existing canManage
  // framing, a UI convenience only (see SetupPanel.tsx / README).
  const canReview = (settings.reviewerGroupId ?? null) !== null && userGroupIds.includes(settings.reviewerGroupId!)

  const isConfigured = settings.provisioned !== null && settings.orgUnits.length > 0

  return (
    <>
      <HeaderBar appName="AMR Stewardship Log" />
      <div style={{ padding: 24, maxWidth: 1000 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <CircularLoader />
          </div>
        ) : error ? (
          <NoticeBox error title="Could not load configuration">
            {error}
          </NoticeBox>
        ) : !isConfigured && tab !== 'configure' ? (
          <EmptyState canManage={canManage} onConfigure={() => setTab('configure')} />
        ) : (
          <>
            <TabBar>
              <Tab selected={tab === 'log'} onClick={() => setTab('log')}>
                Log a prescription
              </Tab>
              <Tab selected={tab === 'summary'} onClick={() => setTab('summary')}>
                Compliance summary
              </Tab>
              {canManage && (
                <Tab selected={tab === 'configure'} onClick={() => setTab('configure')}>
                  Configure Stewardship
                </Tab>
              )}
            </TabBar>

            <div style={{ paddingTop: 24 }}>
              {tab === 'log' && <PrescribingForm settings={settings} onSubmitted={refreshEntries} />}

              {tab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <ComplianceSummary entries={entries} provisioned={settings.provisioned} formulary={settings.formulary} />
                  {selectedAction?.kind === 'followUp' && selectedEntry && settings.provisioned && supportsFollowUp(settings.provisioned) && (
                    <FollowUpForm
                      entry={selectedEntry}
                      provisioned={settings.provisioned}
                      onSubmitted={() => {
                        setSelectedAction(null)
                        refreshEntries()
                      }}
                      onCancel={() => setSelectedAction(null)}
                    />
                  )}
                  {selectedAction?.kind === 'approval' &&
                    selectedEntry &&
                    settings.provisioned &&
                    supportsApproval(settings.provisioned) &&
                    canReview && (
                      <ApprovalForm
                        entry={selectedEntry}
                        provisioned={settings.provisioned}
                        reviewerUsername={username}
                        onSubmitted={() => {
                          setSelectedAction(null)
                          refreshEntries()
                        }}
                        onCancel={() => setSelectedAction(null)}
                      />
                    )}
                  {selectedAction?.kind === 'duration' && selectedEntry && settings.provisioned && supportsDuration(settings.provisioned) && (
                    <DurationForm
                      entry={selectedEntry}
                      provisioned={settings.provisioned}
                      formulary={settings.formulary}
                      onSubmitted={() => {
                        setSelectedAction(null)
                        refreshEntries()
                      }}
                      onCancel={() => setSelectedAction(null)}
                    />
                  )}
                  <EntryList
                    entries={entries}
                    provisioned={settings.provisioned}
                    formulary={settings.formulary}
                    selectedEventId={selectedAction?.eventId ?? null}
                    onSelectFollowUp={(eventId) => setSelectedAction({ kind: 'followUp', eventId })}
                    onSelectApproval={(eventId) => setSelectedAction({ kind: 'approval', eventId })}
                    onSelectDuration={(eventId) => setSelectedAction({ kind: 'duration', eventId })}
                    canReview={canReview}
                  />
                </div>
              )}

              {tab === 'configure' && canManage && (
                <SetupPanel
                  settings={settings}
                  onSave={async (next) => {
                    await save(next)
                    setTab('log')
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
