import {
  buildDataElementPayload,
  buildEventPayload,
  buildProgramPayload,
  buildProgramStagePayload,
  DATA_ELEMENT_DEFS,
  extractCreatedEventId,
  extractTrackerErrorMessage,
  mapTrackerEventToVisit,
  PROGRAM_NAME,
  PROGRAM_SHARING_PAYLOAD,
  type RawTrackerEvent,
  type TrackerImportResponse,
} from './provisioning'
import type { ProvisionedProgram } from '../types/otss'

describe('buildDataElementPayload', () => {
  test('every data element is domainType TRACKER with aggregationType NONE', () => {
    for (const def of DATA_ELEMENT_DEFS) {
      const payload = buildDataElementPayload(def)
      expect(payload.domainType).toBe('TRACKER')
      expect(payload.aggregationType).toBe('NONE')
      expect(payload.valueType).toBe(def.valueType)
    }
  })

  test('there are exactly 7 defined roles', () => {
    expect(DATA_ELEMENT_DEFS.map((d) => d.role).sort()).toEqual(
      [
        'actionPlan',
        'cadreObserved',
        'checklistResponses',
        'competencyPercent',
        'completenessPercent',
        'followUpDate',
        'gapsIdentified',
      ].sort(),
    )
  })

  test('followUpDate is the DATE value type, the one genuinely new-to-this-app element', () => {
    const def = DATA_ELEMENT_DEFS.find((d) => d.role === 'followUpDate')!
    expect(def.valueType).toBe('DATE')
  })
})

describe('buildProgramPayload', () => {
  test('is an event program (WITHOUT_REGISTRATION), no nested programStages', () => {
    const payload = buildProgramPayload(['ou1'])
    expect(payload.programType).toBe('WITHOUT_REGISTRATION')
    expect(payload.name).toBe(PROGRAM_NAME)
    expect(payload).not.toHaveProperty('programStages')
  })
})

describe('buildProgramStagePayload', () => {
  test('references the program by id and lists all 7 data elements', () => {
    const dataElementIds = {
      cadreObserved: 'de1',
      checklistResponses: 'de2',
      completenessPercent: 'de3',
      competencyPercent: 'de4',
      gapsIdentified: 'de5',
      actionPlan: 'de6',
      followUpDate: 'de7',
    }
    const payload = buildProgramStagePayload('prog1', dataElementIds)
    expect(payload.program).toEqual({ id: 'prog1' })
    expect(payload.programStageDataElements).toHaveLength(7)
  })
})

describe('PROGRAM_SHARING_PAYLOAD', () => {
  test('grants metadata read-only, data read+write', () => {
    expect(PROGRAM_SHARING_PAYLOAD.object.publicAccess).toBe('r-rw----')
  })
})

const provisioned: ProvisionedProgram = {
  programId: 'prog1',
  programStageId: 'stage1',
  dataElementIds: {
    cadreObserved: 'de1',
    checklistResponses: 'de2',
    completenessPercent: 'de3',
    competencyPercent: 'de4',
    gapsIdentified: 'de5',
    actionPlan: 'de6',
    followUpDate: 'de7',
  },
}

describe('buildEventPayload', () => {
  test('serializes the checklist as JSON in the checklistResponses data value', () => {
    const payload = buildEventPayload(provisioned, 'ou1', '2026-08-11T00:00:00.000', {
      cadreObserved: 'Nurse',
      checklist: { responses: [{ itemId: 'i1', moduleType: 'Clinical', status: 'Yes', note: null }], registerReviewRecordsReviewed: null },
      completenessPercent: 80,
      competencyPercent: 90,
      gapsIdentified: null,
      actionPlan: null,
      followUpDate: null,
    })
    const event = payload.events[0]
    const checklistDv = event.dataValues.find((dv) => dv.dataElement === 'de2')
    expect(checklistDv).toBeDefined()
    expect(JSON.parse(checklistDv!.value)).toEqual({
      responses: [{ itemId: 'i1', moduleType: 'Clinical', status: 'Yes', note: null }],
      registerReviewRecordsReviewed: null,
    })
  })

  test('omits optional fields entirely when null/empty, never sends empty strings', () => {
    const payload = buildEventPayload(provisioned, 'ou1', '2026-08-11T00:00:00.000', {
      cadreObserved: 'Nurse',
      checklist: { responses: [], registerReviewRecordsReviewed: null },
      completenessPercent: null,
      competencyPercent: null,
      gapsIdentified: null,
      actionPlan: null,
      followUpDate: null,
    })
    const event = payload.events[0]
    // Only cadreObserved + checklistResponses (always sent) should be present.
    expect(event.dataValues).toHaveLength(2)
  })

  test('includes all optional fields when provided', () => {
    const payload = buildEventPayload(provisioned, 'ou1', '2026-08-11T00:00:00.000', {
      cadreObserved: 'Nurse',
      checklist: { responses: [], registerReviewRecordsReviewed: 5 },
      completenessPercent: 100,
      competencyPercent: 100,
      gapsIdentified: 'None',
      actionPlan: 'Follow up next quarter',
      followUpDate: '2026-11-01',
    })
    const event = payload.events[0]
    expect(event.dataValues).toHaveLength(7)
  })
})

describe('extractCreatedEventId / extractTrackerErrorMessage', () => {
  test('extracts the created event uid', () => {
    const response: TrackerImportResponse = {
      status: 'OK',
      bundleReport: { typeReportMap: { EVENT: { objectReports: [{ uid: 'evt1' }] } } },
    }
    expect(extractCreatedEventId(response)).toBe('evt1')
  })

  test('extracts the real DHIS2 error message from a rejected import', () => {
    const response: TrackerImportResponse = {
      status: 'ERROR',
      validationReport: { errorReports: [{ message: 'User: `abc` has no capture scope access to OrganisationUnit: `xyz`.' }] },
    }
    expect(extractTrackerErrorMessage(response)).toContain('no capture scope access')
  })
})

describe('mapTrackerEventToVisit', () => {
  test('maps a raw queried event back to a SupervisionVisit, parsing the checklist JSON', () => {
    const raw: RawTrackerEvent = {
      event: 'evt1',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [
        { dataElement: 'de1', value: 'Nurse' },
        { dataElement: 'de2', value: JSON.stringify({ responses: [{ itemId: 'i1', moduleType: 'Clinical', status: 'Yes', note: null }], registerReviewRecordsReviewed: null }) },
        { dataElement: 'de3', value: '80' },
        { dataElement: 'de4', value: '90' },
      ],
      createdBy: { username: 'tester' },
    }
    const visit = mapTrackerEventToVisit(raw, provisioned, 'Test facility')
    expect(visit.cadreObserved).toBe('Nurse')
    expect(visit.completenessPercent).toBe(80)
    expect(visit.competencyPercent).toBe(90)
    expect(visit.checklist.responses).toHaveLength(1)
    expect(visit.enteredBy).toBe('tester')
  })

  test('falls back to an empty checklist for malformed JSON instead of throwing', () => {
    const raw: RawTrackerEvent = {
      event: 'evt2',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [{ dataElement: 'de2', value: 'not valid json{{{' }],
      createdBy: null,
    }
    const visit = mapTrackerEventToVisit(raw, provisioned, 'Test facility')
    expect(visit.checklist).toEqual({ responses: [], registerReviewRecordsReviewed: null })
    expect(visit.enteredBy).toBeNull()
  })

  test('missing numeric fields map to null, not NaN or zero', () => {
    const raw: RawTrackerEvent = {
      event: 'evt3',
      orgUnit: 'ou1',
      occurredAt: '2026-08-11T00:00:00.000',
      dataValues: [],
      createdBy: null,
    }
    const visit = mapTrackerEventToVisit(raw, provisioned, 'Test facility')
    expect(visit.completenessPercent).toBeNull()
    expect(visit.competencyPercent).toBeNull()
  })
})
