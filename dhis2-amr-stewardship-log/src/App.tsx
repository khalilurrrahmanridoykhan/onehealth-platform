import { CircularLoader, HeaderBar, NoticeBox, Tab, TabBar } from '@dhis2/ui'
import { useEffect, useRef, useState } from 'react'
import { ApprovalForm } from './components/ApprovalForm'
import { ComplianceSummary } from './components/ComplianceSummary'
import { DurationForm } from './components/DurationForm'
import { EmptyState } from './components/EmptyState'
import { EntryList } from './components/EntryList'
import { FollowUpForm } from './components/FollowUpForm'
import { PrescribingForm } from './components/PrescribingForm'
import { SetupPanel } from './components/SetupPanel'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useOverdueNotifications } from './hooks/useOverdueNotifications'
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
  const { entries, loading: entriesLoading, refresh: refreshEntries } = useRecentEntries(settings)
  const [tab, setTab] = useState<ViewTab>('log')
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null)
  const { checkAndNotify } = useOverdueNotifications()
  const hasCheckedOverdueThisVisitRef = useRef(false)

  const selectedEntry = selectedAction ? (entries.find((e) => e.eventId === selectedAction.eventId) ?? null) : null

  // Fails closed: no reviewer group configured yet means canReview is false
  // for everyone, including canManage admins -- approving is a distinct
  // capability from configuring, same as this app's existing canManage
  // framing, a UI convenience only (see SetupPanel.tsx / README).
  const canReview = (settings.reviewerGroupId ?? null) !== null && userGroupIds.includes(settings.reviewerGroupId!)

  const isConfigured = settings.provisioned !== null && settings.orgUnits.length > 0

  // Opportunistic overdue-notification check: fires once per Compliance
  // Summary tab-visit, only for canManage admins. Restricted to canManage
  // (not every authenticated user, even though the messaging API itself has
  // no such restriction) so an ordinary prescriber's page load doesn't
  // trigger a background dataStore write + message-send attempt on every
  // visit -- wasteful, and it widens the last-write-wins race window on the
  // settings blob for no benefit. Restricted to the summary tab since
  // that's the same tab that already visibly computes these overdue counts
  // -- this feature is a convenience trigger on top of that, not an
  // independent poller.
  useEffect(() => {
    if (tab !== 'summary') {
      hasCheckedOverdueThisVisitRef.current = false
      return
    }
    if (!canManage) return
    if (loading || entriesLoading) return
    if (!settings.provisioned || settings.orgUnits.length === 0) return
    if (!settings.notificationGroupId) return
    if (hasCheckedOverdueThisVisitRef.current) return
    hasCheckedOverdueThisVisitRef.current = true
    checkAndNotify(entries, settings, save)
    // Deliberately narrow deps -- entries/settings are read from the render
    // closure at the moment this effect actually fires (by which point
    // they're already current, since the gating conditions above only
    // become true once loading/entriesLoading have settled), not
    // subscribed to. Including them would re-fire on every refresh/save,
    // including the cursor-advance save this same call makes -- the ref
    // guard above is what actually prevents re-firing, not the deps array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canManage, loading, entriesLoading, settings.provisioned, settings.orgUnits.length, settings.notificationGroupId])

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
