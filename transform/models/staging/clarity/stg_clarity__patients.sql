{{
    config(materialized='view')
}}

with source as (
    select * from {{ source('clarity', 'patient') }}
),

renamed as (
    select
        cast(pat_id as varchar)                     as pat_id,
        trim(med_rec_num)                           as mrn,
        trim(pat_name)                              as full_name,
        trim(middle_name)                           as middle_name,
        cast(birth_date as date)                    as birth_date,
        cast(death_dt as date)                      as death_date,
        trim(sex_c_name)                            as sex,
        trim(race_c_name)                           as race,
        -- ethnic_group_c_name not present in source; omitted
        trim(language_c_name)                       as language,
        trim(mail_street_addr)                      as street_address,
        trim(mail_city)                             as city,
        trim(mail_state_c_name)                     as state,
        trim(mail_zip)                              as zip_code,
        trim(mail_country_c_name)                   as country,
        trim(home_phone)                            as home_phone,
        trim(fin_class_c_name)                      as financial_class,
        trim(payor_id_payor_name)                   as payor_name,
        trim(payor_id_payor_type)                   as payor_type,
        trim(plan_id_plan_name)                     as plan_name,
        trim(patient_status_c_name)                 as patient_status,
        trim(patient_type_c_name)                   as patient_type,
        cast(pcp_prov_id as varchar)                as pcp_provider_id,
        trim(pcp_prov_id_pcp_name)                  as pcp_provider_name,
        case
            when deceased_ind_c_name = 'Yes' then true
            else false
        end                                         as is_deceased,
        current_timestamp                           as loaded_at
    from source
)

select * from renamed
