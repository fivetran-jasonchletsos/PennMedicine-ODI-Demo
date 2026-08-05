-- Test: All encounters must have a valid patient
select
    encounter_id,
    pat_id
from {{ ref('fct_encounters') }}
where pat_id is null
   or pat_id not in (select pat_id from {{ ref('dim_patients') }})
