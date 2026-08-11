import {
  buildDataElementPayload,
  buildEventPayload,
  buildProgramPayload,
  buildProgramStagePayload,
  DATA_ELEMENT_DEFS,
  extractCreatedEventId,
  extractTrackerErrorMessage,
  mapTrackerEventToEntry,
  PROGRAM_NAME,
  PROGRAM_SHARING_PAYLOAD,
  type RawTrackerEvent,
  type TrackerImportResponse,
} from './provisioning'
import type { ProvisionedProgram } from '../types/stewardship'

describe('buildDataElementPayload', () => {
  test('every data element is domainType TRACKER with aggregationType NONE -- this is event/case-level data, never aggregated', () => {
    for (const def of DATA_ELEMENT_DEFS) {
      const payload = buildDataElementPayload(def)
      expect(payload.domainType).toBe('TRACKER')
      expect(payload.aggregationType).toBe('NONE')
      expect(payload.valueType).toBe(def.valueType)
    }
  })

  test('there are exactly 5 defined roles, matching the checklist fields', () => {
    expect(DATA_ELEMENT_DEFS.map((d) => d.role).sort()).toEqual(
      ['antibiotic', 'awareCategory', 'empiricOrCultureGuided', 'indication', 'justificationNote'].sort(),
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
  test('references the program by id and lists all 5 data elements', () => {
    const dataElementIds = {
      antibiotic: 'de1',
      indication: 'de2',
      empiricOrCultureGuided: 'de3',
      awareCategory: 'de4',
      justificationNote: 'de5',
    }
    const payload = buildProgramStagePayload('prog1', dataElementIds)
    expect(payload.program).toEqual({ id: 'prog1' })
    expect(payload.programStageDataElements).toHaveLength(5)
    expect(payload.programStageDataElements).toContainEqual({ dataElement: { id: 'de1' } })
  })
})

describe('PROGRAM_SHARING_PAYLOAD', () => {
  test('grants metadata read-only, data read+write -- confirmed live this is what actually gates who can submit an event, alongside org-unit capture scope', () => {
    expect(PROGRAM_SHARING_PAYLOAD.object.publicAccess).toBe('r-rw----')
  })
})

const provisioned: ProvisionedProgram = {
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
    const payload = buildEventPayload(provisioned, 'ou1', '2026-08-11T00:00:00.000', {
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
    const payload = buildEventPayload(provisioned, 'ou1', '2026-08-11T00:00:00.000', {
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
})
