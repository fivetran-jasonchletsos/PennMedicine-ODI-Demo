{{
    config(materialized='view')
}}

-- Identifies patients with chronic conditions based on their diagnosis history
with diagnoses as (
    select * from {{ ref('int_encounter_diagnoses') }}
),

encounters as (
    select * from {{ ref('stg_clarity__encounters') }}
),

patient_dx as (
    select
        e.pat_id,
        d.diagnosis_id,
        d.diagnosis_name,
        d.icd10_code,
        d.is_chronic,
        count(distinct d.encounter_id)              as encounter_count,
        min(e.contact_date)                         as first_seen_date,
        max(e.contact_date)                         as last_seen_date
    from diagnoses d
    inner join encounters e
        on d.encounter_id = e.encounter_id
    group by 1, 2, 3, 4, 5
),

chronic_conditions as (
    select
        pat_id,
        diagnosis_id,
        diagnosis_name,
        icd10_code,
        is_chronic,
        encounter_count,
        first_seen_date,
        last_seen_date
    from patient_dx
    where is_chronic = true or encounter_count >= 2
)

select * from chronic_conditions
