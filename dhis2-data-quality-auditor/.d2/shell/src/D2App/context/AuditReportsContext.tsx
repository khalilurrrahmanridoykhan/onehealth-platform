import { useDataEngine } from '@dhis2/app-runtime'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchAuditReport } from '../hooks/useAuditDataTrust'
import { fetchInstanceValidationCheck } from '../hooks/useInstanceValidation'
import { fetchNativeOutlierCheck } from '../hooks/useOutlierDetection'
import type { DataTrustReport, QualityCheck } from '../lib/qualityChecks'
import type { AuditConfig } from '../types/audit'

export interface AuditReportState {
  loading: boolean
  error: string | null
  report: DataTrustReport | null
  fetchedAt: number | null
}

interface ContextValue {
  reportsByAuditId: Record<string, AuditReportState>
  refresh: (auditId: string) => void
}

const AuditReportsReactContext = createContext<ContextValue | null>(null)

// Fixes the N+1 fetch pattern confirmed in the original app: ProgrammeList's
// rows each called useProgrammeDataTrust independently (all N fetched
// simultaneously, no dedup), and DataTrustDetail fetched the selected one
// again. Fine at a fixed N=8; not fine for an admin-growable N. This provider
// is the ONLY place that fetches report data -- AuditList/AuditDetail read
// from the context, never call useAuditDataTrust directly. A small
// concurrency-limited queue (not "fetch all N simultaneously") is a cheap,
// dependency-free mitigation for large audit counts being nice to the target
// DHIS2 server.
const MAX_CONCURRENT_FETCHES = 3

export function AuditReportsProvider({ audits, children }: { audits: AuditConfig[]; children: ReactNode }) {
  const engine = useDataEngine()
  const [reportsByAuditId, setReportsByAuditId] = useState<Record<string, AuditReportState>>({})
  const inFlightRef = useRef(new Set<string>())
  const queueRef = useRef<string[]>([])
  const auditsRef = useRef(audits)
  auditsRef.current = audits

  const runNext = useCallback(() => {
    while (inFlightRef.current.size < MAX_CONCURRENT_FETCHES && queueRef.current.length > 0) {
      const auditId = queueRef.current.shift()!
      const audit = auditsRef.current.find((a) => a.id === auditId)
      if (!audit) continue
      inFlightRef.current.add(auditId)
      setReportsByAuditId((prev) => ({
        ...prev,
        [auditId]: {
          loading: true,
          error: null,
          report: prev[auditId]?.report ?? null,
          fetchedAt: prev[auditId]?.fetchedAt ?? null,
        },
      }))

      void (async () => {
        try {
          const externalChecks: QualityCheck[] = []
          const [outlierCheck, validationCheck] = await Promise.all([
            fetchNativeOutlierCheck(engine, audit),
            fetchInstanceValidationCheck(engine, audit),
          ])
          if (outlierCheck) externalChecks.push(outlierCheck)
          if (validationCheck) externalChecks.push(validationCheck)

          const report = await fetchAuditReport(engine, audit, externalChecks)
          setReportsByAuditId((prev) => ({
            ...prev,
            [auditId]: { loading: false, error: null, report, fetchedAt: Date.now() },
          }))
        } catch (error) {
          setReportsByAuditId((prev) => ({
            ...prev,
            [auditId]: {
              loading: false,
              error: error instanceof Error ? error.message : String(error),
              report: null,
              fetchedAt: Date.now(),
            },
          }))
        } finally {
          inFlightRef.current.delete(auditId)
          runNext()
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  const enqueue = useCallback(
    (auditId: string) => {
      if (inFlightRef.current.has(auditId) || queueRef.current.includes(auditId)) return
      queueRef.current.push(auditId)
      runNext()
    },
    [runNext],
  )

  useEffect(() => {
    for (const audit of audits) {
      if (!reportsByAuditId[audit.id] && !inFlightRef.current.has(audit.id) && !queueRef.current.includes(audit.id)) {
        enqueue(audit.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audits])

  // Manual re-fetch is the only way to refresh an already-loaded report --
  // selecting an audit that's already in the map never re-triggers a fetch.
  const refresh = useCallback(
    (auditId: string) => {
      setReportsByAuditId((prev) => {
        const next = { ...prev }
        delete next[auditId]
        return next
      })
      enqueue(auditId)
    },
    [enqueue],
  )

  const value = useMemo<ContextValue>(() => ({ reportsByAuditId, refresh }), [reportsByAuditId, refresh])

  return <AuditReportsReactContext.Provider value={value}>{children}</AuditReportsReactContext.Provider>
}

export function useAuditReports(): ContextValue {
  const ctx = useContext(AuditReportsReactContext)
  if (!ctx) throw new Error('useAuditReports must be used within an AuditReportsProvider')
  return ctx
}
