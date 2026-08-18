import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import { NUMERIC_VALUE_TYPES } from '../types/audit'

export interface DataSetDataElement {
  id: string
  name: string
  valueType: string
}

export interface DataSetOrgUnit {
  id: string
  name: string
}

export interface DataSetDetail {
  id: string
  name: string
  periodType: string
  dataElements: DataSetDataElement[]
  organisationUnits: DataSetOrgUnit[]
}

interface State {
  loading: boolean
  error: string | null
  detail: DataSetDetail | null
}

interface RawDetail {
  id: string
  name: string
  periodType: string
  dataSetElements: { dataElement: DataSetDataElement }[]
  organisationUnits: DataSetOrgUnit[]
}

export function isNumericValueType(valueType: string): boolean {
  return (NUMERIC_VALUE_TYPES as readonly string[]).includes(valueType)
}

// Single detail call feeds both the data-element and org-unit pickers in
// AuditForm, avoiding a second org-unit round trip.
export function useDataSetDetail(dataSetId: string | null): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, detail: null })

  useEffect(() => {
    if (!dataSetId) {
      setState({ loading: false, error: null, detail: null })
      return
    }

    let cancelled = false
    setState({ loading: true, error: null, detail: null })

    const query = {
      result: {
        resource: `dataSets/${dataSetId}`,
        params: {
          fields: 'id,name,periodType,dataSetElements[dataElement[id,name,valueType]],organisationUnits[id,name]',
        },
      },
    }

    engine
      .query(query)
      .then((response) => {
        if (cancelled) return
        const raw = (response as unknown as { result: RawDetail }).result
        setState({
          loading: false,
          error: null,
          detail: {
            id: raw.id,
            name: raw.name,
            periodType: raw.periodType,
            dataElements: (raw.dataSetElements ?? []).map((dse) => dse.dataElement),
            organisationUnits: raw.organisationUnits ?? [],
          },
        })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ loading: false, error: error.message, detail: null })
      })

    return () => {
      cancelled = true
    }
  }, [engine, dataSetId])

  return state
}
