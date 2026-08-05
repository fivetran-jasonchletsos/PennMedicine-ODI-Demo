-- Test: No negative charges should exist
select
    account_id,
    total_charges
from {{ ref('fct_account_summary') }}
where total_charges < 0
