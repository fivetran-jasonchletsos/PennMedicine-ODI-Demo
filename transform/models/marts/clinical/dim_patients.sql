{{
    config(materialized='table')
}}

with patients as (
    select * from {{ ref('stg_clarity__patients') }}
),

chronic as (
    select
        pat_id,
        count(distinct diagnosis_id)                as chronic_condition_count,
        array_agg(distinct icd10_code)              as chronic_icd10_codes
    from {{ ref('int_patient_chronic_conditions') }}
    group by 1
),

dim_patients as (
    select
        {{ dbt_utils.generate_surrogate_key(['p.pat_id']) }} as patient_key,
        p.pat_id,
        p.mrn,
        p.full_name,
        p.birth_date,
        date_diff('year', p.birth_date::date, current_date) as age_years,
        p.sex,
        p.race,
        p.language,
        p.street_address,
        p.city,
        p.state,
        p.zip_code,
        p.country,
        p.home_phone,
        p.financial_class,
        p.payor_name,
        p.payor_type,
        p.plan_name,
        p.patient_status,
        p.patient_type,
        p.pcp_provider_id,
        p.pcp_provider_name,
        p.is_deceased,
        coalesce(c.chronic_condition_count, 0)      as chronic_condition_count,
        c.chronic_icd10_codes,
        p.loaded_at
    from patients p
    left join chronic c on p.pat_id = c.pat_id
)

select * from dim_patients
