{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'clarity_ser') }}
),

renamed as (
    select
        cast(prov_id as varchar)                    as provider_id,
        trim(prov_name)                             as provider_name,
        trim(prov_type)                             as provider_type,
        trim(clinician_title)                       as clinician_title,
        cast(primary_specialty_c as varchar)        as specialty_code,
        cast(department_id as varchar)              as primary_department_id,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
