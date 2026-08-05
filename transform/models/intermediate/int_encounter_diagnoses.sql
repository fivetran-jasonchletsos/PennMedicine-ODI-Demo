{{
    config(materialized='view')
}}

with enc_dx as (
    select * from {{ ref('stg_clarity__diagnoses') }}
),

edg as (
    select * from {{ ref('stg_clarity__edg') }}
),

encounter_diagnoses as (
    select
        ed.encounter_id,
        ed.diagnosis_name,
        e.diagnosis_id,
        e.icd10_code,
        ed.diagnosis_line,
        ed.is_primary_diagnosis,
        ed.is_chronic,
        current_timestamp                           as loaded_at
    from enc_dx ed
    left join edg e
        on ed.diagnosis_name = e.diagnosis_name
)

select * from encounter_diagnoses
