import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { buildOverdueNotificationMessage, selectNewlyOverdueEntries } from '../lib/notifications'
import type { PrescribingEntry, StewardshipSettings } from '../types/stewardship'

interface State {
  checking: boolean
  lastError: string | null
}

// The one place this app calls DHIS2's messaging API. Unlike Tracker
// imports (which return HTTP 200 with an embedded validationReport on
// failure, requiring extractTrackerErrorMessage-style JSON parsing),
// POST /api/messageConversations reports failure as a genuine non-2xx HTTP
// status (404 unknown userGroups id, 409 empty resolved recipient set --
// confirmed live: "UserGroup with id ... could not be found." / "No
// recipients selected."). @dhis2/app-runtime's engine.mutate already throws
// a plain Error for a non-2xx response, so no bespoke response-shape parser
// is needed here -- a try/catch reading error.message is sufficient, the
// same pattern useStewardshipSettings.ts already uses.
export function useOverdueNotifications() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ checking: false, lastError: null })

  const checkAndNotify = useCallback(
    async (
      entries: PrescribingEntry[],
      settings: StewardshipSettings,
      save: (next: StewardshipSettings) => Promise<void>,
      now: Date = new Date(),
    ): Promise<void> => {
      if (!settings.notificationGroupId) return
      setState({ checking: true, lastError: null })

      try {
        // Defensive backstop, in addition to SetupPanel's own
        // seed-on-enable write: if a cursor still doesn't exist by the time
        // a check actually runs, there is no honest "since when" baseline
        // -- seed to now and send nothing this cycle, rather than treating
        // a missing cursor as "everything is new" and dumping the whole
        // backlog.
        if (!settings.lastOverdueNotificationCheckAt) {
          await save({ ...settings, lastOverdueNotificationCheckAt: now.toISOString() })
          setState({ checking: false, lastError: null })
          return
        }

        const items = selectNewlyOverdueEntries(entries, settings.formulary, settings.lastOverdueNotificationCheckAt, now)
        if (items.length === 0) {
          setState({ checking: false, lastError: null })
          return
        }

        const { subject, text } = buildOverdueNotificationMessage(items)

        // Explicit two-step: send, THEN advance the cursor only on
        // confirmed success. A failed send (404/409/network) throws here
        // and the cursor is never touched, so the next check retries the
        // same (cursor, now] window rather than silently losing it.
        await engine.mutate({
          resource: 'messageConversations',
          type: 'create',
          data: { subject, text, userGroups: [{ id: settings.notificationGroupId }] },
        })

        await save({ ...settings, lastOverdueNotificationCheckAt: now.toISOString() })
        setState({ checking: false, lastError: null })
      } catch (error) {
        // Background/opportunistic dispatch, not a user-initiated action --
        // never surface this as a blocking error to whichever admin
        // happened to have the Compliance Summary tab open. Logged for
        // diagnosability; lastError is exposed only for an optional,
        // non-blocking UI hint, never a NoticeBox that blocks the page.
        console.error('Overdue notification dispatch failed:', error)
        setState({ checking: false, lastError: error instanceof Error ? error.message : String(error) })
      }
    },
    [engine],
  )

  return { ...state, checkAndNotify }
}
