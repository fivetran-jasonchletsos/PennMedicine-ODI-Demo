{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'clarity_edg') }}
),

renamed as (
    select
        cast(dx_id as varchar)                      as diagnosis_id,
        trim(dx_name)                               as diagnosis_name,
        -- icd9_code not present in source
        trim(icd10_code)                            as icd10_code,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
