import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import type { ProgrammeConfig } from '../config/programmes'
import { buildDataTrustReport, type DataPoint, type DataTrustReport } from '../lib/qualityChecks'

interface RawDataValue {
  dataElement: string
  period: string
  orgUnit: string
  value: string
}

interface DataValueSetsResponse {
  values: { dataValues?: RawDataValue[] }
}

interface State {
  loading: boolean
  error: string | null
  report: DataTrustReport | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useProgrammeDataTrust(programme: ProgrammeConfig): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, report: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null, report: null })

    const query = {
      values: {
        resource: 'dataValueSets',
        params: {
          dataSet: programme.dataSetUid,
          orgUnit: programme.locations.map((location) => location.uid),
          startDate: '2000-01-01',
          endDate: todayIso(),
        },
      },
    }

    engine
      .query(query)
      .then((response) => {
        if (cancelled) return
        const { values } = response as unknown as DataValueSetsResponse
        const dataValues = values.dataValues ?? []
        const relevantElements = new Set([programme.casesDataElementUid, programme.nationalCasesDataElementUid])
        const locationByUid = new Map(programme.locations.map((location) => [location.uid, location]))

        const points: DataPoint[] = dataValues
          .filter((value) => relevantElements.has(value.dataElement) && locationByUid.has(value.orgUnit))
          .map((value) => {
            const location = locationByUid.get(value.orgUnit)!
            return {
              period: value.period,
              locationCode: location.code,
              locationName: location.name,
              value: Number(value.value),
            }
          })

        setState({ loading: false, error: null, report: buildDataTrustReport(points, programme) })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ loading: false, error: error.message, report: null })
      })

    return () => {
      cancelled = true
    }
  }, [engine, programme])

  return state
}
