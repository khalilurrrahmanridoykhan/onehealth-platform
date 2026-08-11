import { CircularLoader, HeaderBar, NoticeBox, Tab, TabBar } from '@dhis2/ui'
import { useState } from 'react'
import { ComplianceSummary } from './components/ComplianceSummary'
import { EmptyState } from './components/EmptyState'
import { EntryList } from './components/EntryList'
import { PrescribingForm } from './components/PrescribingForm'
import { SetupPanel } from './components/SetupPanel'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useRecentEntries } from './hooks/useRecentEntries'
import { useStewardshipSettings } from './hooks/useStewardshipSettings'

type ViewTab = 'log' | 'summary' | 'configure'

export default function App() {
  const { loading, error, settings, save } = useStewardshipSettings()
  const { canManage } = useCurrentUserAuthorities()
  const { entries, refresh: refreshEntries } = useRecentEntries(settings)
  const [tab, setTab] = useState<ViewTab>('log')

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
                  <ComplianceSummary entries={entries} />
                  <EntryList entries={entries} />
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
