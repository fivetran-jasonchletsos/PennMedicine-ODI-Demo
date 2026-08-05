{{
    config(materialized='table')
}}

with spine as (
    select * from {{ ref('int_patient_encounter_spine') }}
),

fct_encounters as (
    select
        {{ dbt_utils.generate_surrogate_key(['encounter_id']) }} as encounter_key,
        encounter_id,
        pat_id,
        mrn,
        patient_name,
        birth_date,
        sex,
        zip_code,
        payor_name,
        contact_date,
        extract(year from contact_date::date)       as encounter_year,
        extract(month from contact_date::date)      as encounter_month,
        extract(quarter from contact_date::date)    as encounter_quarter,
        dayofweek(contact_date::date)               as encounter_day_of_week,
        encounter_type,
        appointment_status,
        is_inpatient,
        length_of_stay_days,
        admission_datetime,
        discharge_datetime,
        encounter_financial_class,
        provider_id,
        provider_name,
        provider_type,
        department_id,
        department_name,
        department_specialty_code,
        loaded_at
    from spine
)

select * from fct_encounters
