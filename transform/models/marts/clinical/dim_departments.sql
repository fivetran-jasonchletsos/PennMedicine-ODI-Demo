{{
    config(materialized='table')
}}

with departments as (
    select * from {{ ref('stg_clarity__departments') }}
),

dim_departments as (
    select
        {{ dbt_utils.generate_surrogate_key(['department_id']) }} as department_key,
        department_id,
        department_name,
        specialty_code,
        service_area_id,
        loaded_at
    from departments
)

select * from dim_departments
