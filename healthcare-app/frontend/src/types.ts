// ============================================================
// Shared types — mirror the dbt Labs marts in Snowflake.
//   clinical.dim_patients, clinical.fct_encounters, clinical.fct_diagnoses,
//   clinical.dim_providers, clinical.dim_departments,
//   financial.fct_account_summary
// ============================================================

export interface SummaryStats {
  total_patients: number;
  total_encounters: number;
  total_diagnoses: number;
  avg_encounter_cost: number;
  active_chronic_count: number;
  current_year: number;
  generated_at?: string;
  source?: 'live' | 'demo';
}

export interface PatientSearchResult {
  pat_id: string;
  med_rec_num: string;
  full_name: string;
  birth_date: string;
  age: number;
  sex: string;
  city: string | null;
  zip_code: string | null;
  primary_care_provider: string | null;
  active_chronic_count: number;
  encounter_count: number;
  total_charges: number;
  latitude?: number | null;
  longitude?: number | null;
  last_encounter_date?: string | null;
}

export interface PatientSearchResponse {
  count: number;
  results: PatientSearchResult[];
}

export interface PatientDetail {
  pat_id: string;
  med_rec_num: string;
  full_name: string;
  birth_date: string;
  age: number;
  sex: string;
  race: string | null;
  ethnicity: string | null;
  mailing_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  primary_care_provider: string | null;
  primary_care_department: string | null;
  active_chronic_count: number;
  latitude: number | null;
  longitude: number | null;
}

export interface EncounterRow {
  pat_enc_csn_id: string;
  contact_date: string;
  encounter_type: string;
  department_name: string;
  provider_name: string;
  chief_complaint: string | null;
  diagnosis_count: number;
  total_charges: number;
}

export interface EncountersResponse {
  pat_id: string;
  encounters: EncounterRow[];
}

export interface DiagnosisRow {
  dx_id: string;
  pat_enc_csn_id: string;
  icd10_code: string;
  diagnosis_name: string;
  chronic: boolean;
  first_recorded: string;
}

export interface DiagnosesResponse {
  pat_id: string;
  diagnoses: DiagnosisRow[];
}

export interface AccountRow {
  hsp_account_id: string;
  account_type: string;
  status: string;
  total_charges: number;
  total_payments: number;
  current_balance: number;
  primary_payer: string | null;
  opened_date: string;
  closed_date: string | null;
}

export interface AccountsResponse {
  pat_id: string;
  summary: {
    total_charges: number;
    total_payments: number;
    outstanding_balance: number;
    account_count: number;
  };
  accounts: AccountRow[];
}

export interface ComparableRow {
  pat_id: string;
  full_name: string;
  age: number;
  sex: string;
  chronic_overlap_count: number;
  encounter_count: number;
  total_charges: number;
}

export interface ComparablesResponse {
  pat_id: string;
  comparables: ComparableRow[];
}
