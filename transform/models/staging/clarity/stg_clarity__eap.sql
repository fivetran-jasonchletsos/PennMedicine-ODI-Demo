{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'clarity_eap') }}
),

renamed as (
    select
        cast(proc_id as varchar)                    as proc_id,
        trim(proc_name)                             as proc_name,
        trim(proc_code)                             as proc_code,
        trim(type_c)                                as proc_type,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
