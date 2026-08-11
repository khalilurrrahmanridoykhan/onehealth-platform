import { CircularLoader, HeaderBar, NoticeBox, Tab, TabBar } from '@dhis2/ui'
import { useState } from 'react'
import { EmptyState } from './components/EmptyState'
import { SetupPanel } from './components/SetupPanel'
import { VisitForm } from './components/VisitForm'
import { VisitList } from './components/VisitList'
import { VisitSummary } from './components/VisitSummary'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useOtssSettings } from './hooks/useOtssSettings'
import { useRecentVisits } from './hooks/useRecentVisits'

type ViewTab = 'log' | 'summary' | 'configure'

export default function App() {
  const { loading, error, settings, save } = useOtssSettings()
  const { canManage } = useCurrentUserAuthorities()
  const { visits, refresh: refreshVisits } = useRecentVisits(settings)
  const [tab, setTab] = useState<ViewTab>('log')

  const isConfigured = settings.provisioned !== null && settings.orgUnits.length > 0

  return (
    <>
      <HeaderBar appName="OTSS Supervision Log" />
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
                Log a visit
              </Tab>
              <Tab selected={tab === 'summary'} onClick={() => setTab('summary')}>
                Visit summary
              </Tab>
              {canManage && (
                <Tab selected={tab === 'configure'} onClick={() => setTab('configure')}>
                  Configure
                </Tab>
              )}
            </TabBar>

            <div style={{ paddingTop: 24 }}>
              {tab === 'log' && <VisitForm settings={settings} onSubmitted={refreshVisits} />}

              {tab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <VisitSummary visits={visits} checklist={settings.checklist} />
                  <VisitList visits={visits} />
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
