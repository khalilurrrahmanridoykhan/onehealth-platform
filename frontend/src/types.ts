export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Location {
  code: string
  name: string
  level: 'national' | 'division'
}

export interface SurveillanceRecord {
  disease_code: string
  disease_name: string
  period_start: string
  period_end: string
  period_label: string
  location_code: string
  location_name: string
  location_level: string
  cases: number
  complete_period: boolean
}

export interface Alert {
  disease_code: string
  location_code: string
  period: string
  risk_level: RiskLevel
  observed_cases: number
  expected_cases: number
  predicted_cases: number
  confidence: number
  reasons: string[]
  recommended_actions: string[]
}

export interface OverviewItem {
  location_code: string
  location_name: string
  location_level: 'national' | 'division'
  periods: number
  total_cases: number
  latest_period: string
  latest_cases: number
  risk_level: RiskLevel | null
  expected_cases: number | null
}

export interface EBSStage {
  code: string
  uid: string
  fields: string[]
  required_fields: string[]
  repeatable: boolean
}

export interface EBSSignalDraft {
  signal_id: string
  title: string
  source: string
  signal_type: string
  description: string
  location_code: string
  detected_on: string
}

export interface EBSPreview {
  mode: 'PREVIEW'
  bundle: {
    trackedEntities: Array<{ trackedEntity: string; orgUnit: string }>
    enrollments: Array<{ enrollment: string; status: string }>
    events: Array<{ event: string; status: string; orgUnit: string }>
  }
}

export interface EBSStageDraft {
  stage: string
  enrollment_uid: string
  location_code: string
  occurred_on: string
  values: Record<string, string | number>
}

export interface EBSStagePreview {
  mode: 'PREVIEW'
  stage: string
  bundle: {
    events: Array<{
      event: string
      programStage: string
      enrollment: string
      status: string
      orgUnit: string
      dataValues: Array<{ dataElement: string; value: string }>
    }>
  }
}

export interface EBSCommitResult {
  mode: 'COMMITTED'
  tracked_entity_uid?: string
  enrollment_uid: string
  event_uid: string
  stage?: string
  response: Record<string, unknown>
}

export interface EBSConnectionStatus {
  dhis2_configured: boolean
  reads_enabled: boolean
  writes_enabled: boolean
  program_uid: string
}

export interface EBSSavedSignal {
  tracked_entity_uid: string
  org_unit_uid: string
  signal_id: string
  title: string
  source: string
  created_at: string | null
  updated_at: string | null
}

export interface EBSSignalEvent {
  event_uid: string
  stage: string
  status: string
  occurred_at: string | null
  updated_at: string | null
  values: Record<string, string | number>
}

export interface EBSSignalDetail extends EBSSavedSignal {
  enrollment_uid: string | null
  events: EBSSignalEvent[]
}

export interface EBSOperationItem {
  tracked_entity_uid: string
  enrollment_uid: string | null
  signal_id: string
  title: string
  source: string
  org_unit_uid: string
  latest_stage: string
  risk_level: string | null
  responsible_officer: string | null
  recommended_actions: string | null
  due_date: string | null
  days_remaining: number | null
  due_state: 'COMPLETED' | 'UNSCHEDULED' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'ON_TRACK'
  response_status: string | null
  closed: boolean
  overdue: boolean
  event_count: number
  updated_at: string | null
}

export interface EBSOperations {
  signals: EBSOperationItem[]
  summary: { total: number; open: number; closed: number; overdue: number; due_soon: number; unassigned: number; high_risk: number }
  filtered_count: number
  generated_at: string
}

export interface EBSNotification {
  id: string
  type: 'OVERDUE' | 'DUE_SOON' | 'UNASSIGNED'
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  title: string
  message: string
  signal_id: string
  tracked_entity_uid: string
  officer: string | null
  due_date: string | null
}

export interface EBSNotifications {
  notifications: EBSNotification[]
  unread_count: number
  generated_at: string
}

export interface EBSAssignmentDraft {
  responsible_officer: string
  due_date: string
  recommended_actions: string
  response_status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
}
