{{
    config(materialized='view')
}}

with encounters as (
    select * from {{ ref('stg_clarity__encounters') }}
),

patients as (
    select * from {{ ref('stg_clarity__patients') }}
),

departments as (
    select * from {{ ref('stg_clarity__departments') }}
),

providers as (
    select * from {{ ref('stg_clarity__providers') }}
),

spine as (
    select
        e.encounter_id,
        e.pat_id,
        p.mrn,
        p.full_name                                 as patient_name,
        p.birth_date,
        p.sex,
        p.zip_code,
        p.financial_class                           as patient_financial_class,
        p.payor_name,
        p.is_deceased,
        e.contact_date,
        e.encounter_type,
        e.appointment_status,
        e.is_inpatient,
        e.length_of_stay_days,
        e.admission_datetime,
        e.discharge_datetime,
        e.financial_class                           as encounter_financial_class,
        coalesce(pr.provider_name, e.provider_name) as provider_name,
        pr.provider_id,
        pr.provider_type,
        pr.clinician_title,
        coalesce(d.department_name, e.department_name) as department_name,
        d.department_id,
        d.specialty_code                            as department_specialty_code,
        current_timestamp                           as loaded_at
    from encounters e
    inner join patients p
        on e.pat_id = p.pat_id
    left join departments d
        on e.department_name = d.department_name
    left join providers pr
        on e.provider_name = pr.provider_name
)

select * from spine
