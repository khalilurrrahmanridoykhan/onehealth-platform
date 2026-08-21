import {
  buildDataElementPayload,
  buildEventPayload,
  buildFollowUpEventPayload,
  buildProgramPayload,
  buildProgramStagePayload,
  DATA_ELEMENT_DEFS,
  extractCreatedEventId,
  extractTrackerErrorMessage,
  extractUpdatedEventStats,
  mapTrackerEventToEntry,
  PROGRAM_NAME,
  PROGRAM_SHARING_PAYLOAD,
  type ExistingEventForUpdate,
  type RawTrackerEvent,
  type TrackerImportResponse,
} from './provisioning'
import type { FollowUpCapableProgram, ProvisionedProgram } from '../types/stewardship'

describe('buildDataElementPayload', () => {
  test('every data element is domainType TRACKER with aggregationType NONE -- this is event/case-level data, never aggregated', () => {
    for (const def of DATA_ELEMENT_DEFS) {
      const payload = buildDataElementPayload(def)
      expect(payload.domainType).toBe('TRACKER')
      expect(payload.aggregationType).toBe('NONE')
      expect(payload.valueType).toBe(def.valueType)
    }
  })

  test('there are exactly 8 defined roles, matching the checklist fields plus the 3 de-escalation follow-up fields', () => {
    expect(DATA_ELEMENT_DEFS.map((d) => d.role).sort()).toEqual(
      [
        'antibiotic',
        'awareCategory',
        'empiricOrCultureGuided',
        'indication',
        'justificationNote',
        'deEscalationOutcome',
        'deEscalationDate',
        'deEscalationNote',
      ].sort(),
    )
  })
})

describe('buildProgramPayload', () => {
  test('is an event program (WITHOUT_REGISTRATION), never a registration/tracked-entity program -- no patient identity by design', () => {
    const payload = buildProgramPayload(['ou1', 'ou2'])
    expect(payload.programType).toBe('WITHOUT_REGISTRATION')
    expect(payload.name).toBe(PROGRAM_NAME)
    expect(payload.organisationUnits).toEqual([{ id: 'ou1' }, { id: 'ou2' }])
  })

  test('does NOT include a nested programStages array -- confirmed live that DHIS2 rejects that shape', () => {
    const payload = buildProgramPayload(['ou1'])
    expect(payload).not.toHaveProperty('programStages')
  })
})

describe('buildProgramStagePayload', () => {
  test('references the program by id and lists all 8 data elements', () => {
    const dataElementIds = {
      antibiotic: 'de1',
      indication: 'de2',
      empiricOrCultureGuided: 'de3',
      awareCategory: 'de4',
      justificationNote: 'de5',
      deEscalationOutcome: 'de6',
      deEscalationDate: 'de7',
      deEscalationNote: 'de8',
    }
    const payload = buildProgramStagePayload('prog1', dataElementIds)
    expect(payload.program).toEqual({ id: 'prog1' })
    expect(payload.programStageDataElements).toHaveLength(8)
    expect(payload.programStageDataElements).toContainEqual({ dataElement: { id: 'de1' } })
    expect(payload.programStageDataElements).toContainEqual({ dataElement: { id: 'de8' } })
  })
})

describe('PROGRAM_SHARING_PAYLOAD', () => {
  test('grants metadata read-only, data read+write -- confirmed live this is what actually gates who can submit an event, alongside org-unit capture scope', () => {
    expect(PROGRAM_SHARING_PAYLOAD.object.publicAccess).toBe('r-rw----')
  })
})

const provisioned: FollowUpCapableProgram = {
  programId: 'prog1',
  programStageId: 'stage1',
  dataElementIds: {
    antibiotic: 'de1',
    indication: 'de2',
    empiricOrCultureGuided: 'de3',
    awareCategory: 'de4',
    justificationNote: 'de5',
    deEscalationOutcome: 'de6',
    deEscalationDate: 'de7',
    deEscalationNote: 'de8',
  },
}

const preFollowUpProvisioned: ProvisionedProgram = {
  programId: 'prog1',
  programStageId: 'stage1',
  dataElementIds: {
    antibiotic: 'de1',
    indication: 'de2',
    empiricOrCultureGuided: 'de3',
    awareCategory: 'de4',
    justificationNote: 'de5',
  },
}

describe('buildEventPayload', () => {
  test('omits the justification data value entirely when none was given -- not sent as an empty string', () => {
    const payload = buildEventPayload(preFollowUpProvisioned, 'ou1', '2026-08-11T00:00:00.000', {
      antibiotic: 'Amoxicillin',
      indication: 'UTI',
      empiricOrCultureGuided: 'Empiric',
      awareCategory: 'Access',
      justificationNote: null,
    })
    const event = payload.events[0]
    expect(event.program).toBe('prog1')
    expect(event.programStage).toBe('stage1')
    expect(event.status).toBe('COMPLETED')
    expect(event.dataValues).toHaveLength(4)
    expect(event.dataValues.find((dv) => dv.dataElement === 'de5')).toBeUndefined()
  })

  test('includes the justification data value when given', () => {
    const payload = buildEventPayload(preFollowUpProvisioned, 'ou1', '2026-08-11T00:00:00.000', {
      antibiotic: 'Vancomycin',
      indication: 'Confirmed MRSA',
      empiricOrCultureGuided: 'Culture-guided',
      awareCategory: 'Reserve',
      justificationNote: 'Positive blood culture, MRSA confirmed',
    })
    const event = payload.events[0]
    expect(event.dataValues).toHaveLength(5)
    expect(event.dataValues).toContainEqual({ dataElement: 'de5', value: 'Positive blood culture, MRSA confirmed' })
  })
})

describe('extractCreatedEventId / extractTrackerErrorMessage', () => {
  test('extracts the created event uid from a successful tracker import response', () => {
    const response: TrackerImportResponse = {
      status: 'OK',
      bundleReport: { typeReportMap: { EVENT: { objectReports: [{ uid: 'evt1' }] } } },
    }
    expect(extractCreatedEventId(response)).toBe('evt1')
    expect(extractTrackerErrorMessage(response)).toBeNull()
  })

  test('extracts the real DHIS2 error message from a rejected import -- confirmed live wording for the capture-scope case', () => {
    const response: TrackerImportResponse = {
      status: 'ERROR',
      validationReport: {
        errorReports: [{ message: 'User: `abc` has no capture scope access to OrganisationUnit: `xyz`.' }],
      },
    }
    expect(extractCreatedEventId(response)).toBeNull()
    expect(extractTrackerErrorMessage(response)).toContain('no capture scope access')
  })
})

describe('extractUpdatedEventStats', () => {
  test('extracts stats.updated -- confirmed live shape of an importStrategy=UPDATE response', () => {
    expect(extractUpdatedEventStats({ status: 'OK', stats: { updated: 1 } })).toEqual({ updated: 1 })
  })

  test('a status OK response with updated: 0 is still surfaced -- a stale/unrecognized event uid is a silent no-op, not a success', () => {
    expect(extractUpdatedEventStats({ status: 'OK', stats: { updated: 0 } })).toEqual({ updated: 0 })
  })

  test('returns null when stats is entirely absent', () => {
    expect(extractUpdatedEventStats({ status: 'ERROR' })).toBeNull()
  })
})

describe('buildFollowUpEventPayload', () => {
  const existing: ExistingEventForUpdate = {
    event: 'evt1',
    orgUnit: 'ou1',
    occurredAt: '2026-08-11T00:00:00.000',
    status: 'COMPLETED',
    dataValues: [
      { dataElement: 'de1', value: 'Amoxicillin' },
      { dataElement: 'de2', value: 'UTI' },
      { dataElement: 'de3', value: 'Empiric' },
      { dataElement: 'de4', value: 'Access' },
      // A dataValue whose dataElement this app has no known role for --
      // the regression guard on the data-loss risk: an update must never
      // drop a field it doesn't itself understand.
      { dataElement: 'de-unknown', value: 'left alone' },
    ],
  }

  test('preserves all pre-existing dataValues, including one with an unrecognized dataElement, and adds the follow-up fields', () => {
    const payload = buildFollowUpEventPayload(provisioned, existing, {
      deEscalationOutcome: 'Narrowed',
      deEscalationDate: '2026-08-13',
      deEscalationNote: null,
    })
    const dataValues = payload.events[0].dataValues
    expect(dataValues).toContainEqual({ dataElement: 'de1', value: 'Amoxicillin' })
    expect(dataValues).toContainEqual({ dataElement: 'de2', value: 'UTI' })
    expect(dataValues).toContainEqual({ dataElement: 'de3', value: 'Empiric' })
    expect(dataValues).toContainEqual({ dataElement: 'de4', value: 'Access' })
    expect(dataValues).toContainEqual({ dataElement: 'de-unknown', value: 'left alone' })
    expect(dataValues).toContainEqual({ dataElement: 'de6', value: 'Narrowed' })
    expect(dataValues).toContainEqual({ dataElement: 'de7', value: '2026-08-13' })
  })

  test('preserves occurredAt, orgUnit, and status verbatim, and carries the original event uid -- occurredAt is the prescribing date, never overwritten with today', () => {
    const payload = buildFollowUpEventPayload(provisioned, existing, {
      deEscalationOutcome: 'Continued (confirmed appropriate)',
      deEscalationDate: '2026-08-13',
      deEscalationNote: null,
    })
    const event = payload.events[0]
    expect(event.event).toBe('evt1')
    expect(event.orgUnit).toBe('ou1')
    expect(event.occurredAt).toBe('2026-08-11T00:00:00.000')
    expect(event.status).toBe('COMPLETED')
  })

  test('omits the note data value entirely when none was given -- matching justificationNote convention', () => {
    const payload = buildFollowUpEventPayload(provisioned, existing, {
      deEscalationOutcome: 'Discontinued',
      deEscalationDate: '2026-08-13',
      deEscalationNote: null,
    })
    expect(payload.events[0].dataValues.find((dv) => dv.dataElement === 'de8')).toBeUndefined()
  })

  test('includes the note data value when given', () => {
    const payload = buildFollowUpEventPayload(provisioned, existing, {
      deEscalationOutcome: 'Broadened',
      deEscalationDate: '2026-08-13',
      deEscalationNote: 'Escalated after treatment failure',
    })
    expect(payload.events[0].dataValues).toContainEqual({ dataElement: 'de8', value: 'Escalated after treatment failure' })
  })

  test('upserts (replaces by dataElement), not appends, when re-recording an already-recorded follow-up', () => {
    const alreadyRecorded: ExistingEventForUpdate = {
      ...existing,
      dataValues: [...existing.dataValues, { dataElement: 'de6', value: 'Broadened' }, { dataElement: 'de7', value: '2026-08-12' }],
    }
    const payload = buildFollowUpEventPayload(provisioned, alreadyRecorded, {
      deEscalationOutcome: 'Narrowed',
      deEscalationDate: '2026-08-14',
      deEscalationNote: null,
    })
    const outcomeValues = payload.events[0].dataValues.filter((dv) => dv.dataElement === 'de6')
    const dateValues = payload.events[0].dataValues.filter((dv) => dv.dataElement === 'de7')
    expect(outcomeValues).toEqual([{ dataElement: 'de6', value: 'Narrowed' }])
    expect(dateValues).toEqual([{ dataElement: 'de7', value: '2026-08-14' }])
  })
})

describe('mapTrackerEventToEntry', () => {
  test('maps a raw queried event back to a PrescribingEntry using the provisioned dataElementIds', () => {
    const raw: RawTrackerEvent = {
      event: 'evt1',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [
        { dataElement: 'de1', value: 'Amoxicillin' },
        { dataElement: 'de2', value: 'UTI' },
        { dataElement: 'de3', value: 'Empiric' },
        { dataElement: 'de4', value: 'Access' },
      ],
      createdBy: { username: 'tester' },
    }
    const mapped = mapTrackerEventToEntry(raw, provisioned, 'Test facility')
    expect(mapped).toEqual({
      eventId: 'evt1',
      orgUnitId: 'ou1',
      orgUnitName: 'Test facility',
      occurredAt: '2026-08-11T00:00:00.000',
      antibioticName: 'Amoxicillin',
      awareCategory: 'Access',
      indication: 'UTI',
      empiricOrCultureGuided: 'Empiric',
      justificationNote: null,
      enteredBy: 'tester',
      deEscalationOutcome: null,
      deEscalationDate: null,
      deEscalationNote: null,
    })
  })

  test('falls back to "Not classified" for an unrecognized or missing AWaRe value rather than throwing', () => {
    const raw: RawTrackerEvent = {
      event: 'evt2',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [{ dataElement: 'de1', value: 'Some drug' }],
      createdBy: null,
    }
    const mapped = mapTrackerEventToEntry(raw, provisioned, 'Test facility')
    expect(mapped.awareCategory).toBe('Not classified')
    expect(mapped.empiricOrCultureGuided).toBeNull()
    expect(mapped.enteredBy).toBeNull()
  })

  test('round-trips the follow-up fields when present', () => {
    const raw: RawTrackerEvent = {
      event: 'evt3',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [
        { dataElement: 'de1', value: 'Amoxicillin' },
        { dataElement: 'de3', value: 'Empiric' },
        { dataElement: 'de6', value: 'Narrowed' },
        { dataElement: 'de7', value: '2026-08-13' },
        { dataElement: 'de8', value: 'Culture confirmed susceptible' },
      ],
      createdBy: null,
    }
    const mapped = mapTrackerEventToEntry(raw, provisioned, 'Test facility')
    expect(mapped.deEscalationOutcome).toBe('Narrowed')
    expect(mapped.deEscalationDate).toBe('2026-08-13')
    expect(mapped.deEscalationNote).toBe('Culture confirmed susceptible')
  })

  test('maps an unrecognized outcome string to null rather than throwing', () => {
    const raw: RawTrackerEvent = {
      event: 'evt4',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [{ dataElement: 'de6', value: 'Some future outcome not yet known to this app' }],
      createdBy: null,
    }
    const mapped = mapTrackerEventToEntry(raw, provisioned, 'Test facility')
    expect(mapped.deEscalationOutcome).toBeNull()
  })
})
