{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'enroll_info') }}
),

renamed as (
    select
        cast(patient_id as varchar)                 as pat_id,
        cast(protocol_id as varchar)                as protocol_id,
        trim(protocol_id_protocol_name)             as protocol_name,
        cast(protocol_line as integer)              as protocol_line,
        trim(enroll_status_c_name)                  as enrollment_status,
        cast(start_dttm as timestamp)               as enrollment_start_datetime,
        cast(end_dttm as timestamp)                 as enrollment_end_datetime,
        cast(withdraw_dttm as timestamp)            as withdrawal_datetime,
        trim(withdraw_reason_c_name)                as withdrawal_reason,
        trim(user_id_name)                          as enrolled_by,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
