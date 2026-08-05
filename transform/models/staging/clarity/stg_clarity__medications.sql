{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'clarity_medication') }}
),

renamed as (
    select
        cast(medication_id as varchar)              as medication_id,
        trim(name)                                  as medication_name,
        trim(generic_name)                          as generic_name,
        cast(pharm_class_c as varchar)              as pharmaceutical_class_code,
        cast(thera_class_c as varchar)              as therapeutic_class_code,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
