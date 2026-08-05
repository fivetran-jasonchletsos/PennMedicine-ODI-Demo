{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'pat_enc_dx') }}
),

renamed as (
    select
        cast(pat_enc_csn_id as varchar)             as encounter_id,
        trim(dx_id_dx_name)                         as diagnosis_name,
        cast(line as integer)                       as diagnosis_line,
        case
            when primary_dx_yn = 'Y' then true
            else false
        end                                         as is_primary_diagnosis,
        case
            when dx_chronic_yn = 'Y' then true
            else false
        end                                         as is_chronic,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
