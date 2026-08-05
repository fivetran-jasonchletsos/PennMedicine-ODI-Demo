{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'clarity_dep') }}
),

renamed as (
    select
        cast(department_id as varchar)              as department_id,
        trim(department_name)                       as department_name,
        -- specialty_dep_c_name not in source; use specialty_dep_c as raw code
        cast(specialty_dep_c as varchar)            as specialty_code,
        cast(serv_area_id as varchar)               as service_area_id,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
