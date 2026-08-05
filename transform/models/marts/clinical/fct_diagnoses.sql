{{
    config(materialized='table')
}}

with diagnoses as (
    select * from {{ ref('int_encounter_diagnoses') }}
),

encounters as (
    select * from {{ ref('stg_clarity__encounters') }}
),

fct_diagnoses as (
    select
        {{ dbt_utils.generate_surrogate_key(['d.encounter_id', 'd.diagnosis_name', 'd.diagnosis_line']) }} as diagnosis_key,
        d.encounter_id,
        e.pat_id,
        e.contact_date,
        extract(year from e.contact_date::date)     as encounter_year,
        extract(month from e.contact_date::date)    as encounter_month,
        d.diagnosis_id,
        d.diagnosis_name,
        d.icd10_code,
        d.diagnosis_line,
        d.is_primary_diagnosis,
        d.is_chronic,
        e.encounter_type,
        e.department_name,
        e.provider_name,
        d.loaded_at
    from diagnoses d
    inner join encounters e
        on d.encounter_id = e.encounter_id
)

select * from fct_diagnoses
