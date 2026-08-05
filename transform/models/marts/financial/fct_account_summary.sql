{{
    config(materialized='table')
}}

with financials as (
    select * from {{ ref('int_financials') }}
),

fct_account_summary as (
    select
        {{ dbt_utils.generate_surrogate_key(['account_id']) }} as account_key,
        account_id,
        pat_id,
        encounter_id,
        mrn,
        patient_name,
        account_class,
        account_financial_class,
        admission_date,
        discharge_date,
        extract(year from admission_date::date)     as admission_year,
        extract(month from admission_date::date)    as admission_month,
        extract(quarter from admission_date::date)  as admission_quarter,
        copay_amount,
        deductible_amount,
        disallowed_amount,
        discharge_disposition,
        drg_name,
        encounter_type,
        department_name,
        provider_name,
        loaded_at
    from financials
)

select * from fct_account_summary
