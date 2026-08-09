import { HeaderBar } from '@dhis2/ui'
import { useState } from 'react'
import { DataTrustDetail } from './components/DataTrustDetail'
import { ProgrammeList } from './components/ProgrammeList'
import { PROGRAMMES } from './config/programmes'

export default function App() {
  const [selected, setSelected] = useState(PROGRAMMES[0].code)
  const programme = PROGRAMMES.find((p) => p.code === selected)!

  return (
    <>
      <HeaderBar appName="OneHealth Data Trust" />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 48px)' }}>
        <aside style={{ width: 260, flexShrink: 0, borderRight: '1px solid #e0e0e0' }}>
          <ProgrammeList selected={selected} onSelect={setSelected} />
        </aside>
        <main style={{ flex: 1, padding: 24, maxWidth: 1100 }}>
          <DataTrustDetail programme={programme} />
        </main>
      </div>
    </>
  )
}
