{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'hsp_account') }}
),

renamed as (
    select
        cast(hsp_account_id as varchar)             as account_id,
        cast(pat_id as varchar)                     as pat_id,
        cast(encounter_id as varchar)               as encounter_id,
        trim(account_type_c_name)                   as account_class,
        trim(financial_class_c_name)                as financial_class,
        cast(admit_dt as date)                      as admission_date,
        cast(discharge_dt as date)                  as discharge_date,
        cast(copay_amt as decimal(18, 2))           as copay_amount,
        cast(deductible_amt as decimal(18, 2))      as deductible_amount,
        cast(disallowed_amt as decimal(18, 2))      as disallowed_amount,
        trim(discharge_disposition_c_name)          as discharge_disposition,
        trim(drg_id_drg_name)                       as drg_name,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
