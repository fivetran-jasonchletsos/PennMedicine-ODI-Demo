{{
    config(materialized='view')
}}

with accounts as (
    select * from {{ ref('stg_clarity__hsp_accounts') }}
),

encounters as (
    select * from {{ ref('int_patient_encounter_spine') }}
),

patients as (
    select * from {{ ref('stg_clarity__patients') }}
),

financials as (
    select
        a.account_id,
        a.pat_id,
        a.encounter_id,
        p.mrn,
        p.full_name                                 as patient_name,
        p.financial_class                           as patient_financial_class,
        a.account_class,
        a.financial_class                           as account_financial_class,
        a.copay_amount,
        a.deductible_amount,
        a.disallowed_amount,
        a.admission_date,
        a.discharge_date,
        a.discharge_disposition,
        a.drg_name,
        e.encounter_type,
        e.department_name,
        e.provider_name,
        current_timestamp                           as loaded_at
    from accounts a
    left join patients p
        on a.pat_id = p.pat_id
    left join encounters e
        on a.encounter_id = e.encounter_id
)

select * from financials
