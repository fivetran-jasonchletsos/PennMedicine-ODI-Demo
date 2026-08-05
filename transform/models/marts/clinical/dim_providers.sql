{{
    config(materialized='table')
}}

with providers as (
    select * from {{ ref('stg_clarity__providers') }}
),

dim_providers as (
    select
        {{ dbt_utils.generate_surrogate_key(['provider_id']) }} as provider_key,
        provider_id,
        provider_name,
        provider_type,
        clinician_title,
        specialty_code,
        primary_department_id,
        loaded_at
    from providers
)

select * from dim_providers
