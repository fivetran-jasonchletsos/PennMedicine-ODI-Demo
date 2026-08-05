{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'pat_enc') }}
),

renamed as (
    select
        cast(pat_enc_csn_id as varchar)             as encounter_id,
        cast(pat_id as varchar)                     as pat_id,
        cast(contact_date as date)                  as contact_date,
        trim(hosp_admsn_type_c_name)                as encounter_type,
        trim(appt_status_c_name)                    as appointment_status,
        cast(hosp_admsn_time as timestamp)          as admission_datetime,
        cast(hosp_dischrg_time as timestamp)        as discharge_datetime,
        trim(visit_prov_id_prov_name)               as provider_name,
        trim(department_id_external_name)           as department_name,
        trim(fin_class_c_name)                      as financial_class,
        case
            when hosp_admsn_type_c_name is not null
            then true else false
        end                                         as is_inpatient,
        case
            when hosp_admsn_time is not null and hosp_dischrg_time is not null
            then datediff('day', cast(hosp_admsn_time as date), cast(hosp_dischrg_time as date))
            else null
        end                                         as length_of_stay_days,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
