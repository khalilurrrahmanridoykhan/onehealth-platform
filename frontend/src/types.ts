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

