{% macro clean_icd10(icd10_column) %}
    trim(
        regexp_replace(
            upper({{ icd10_column }}),
            '[^A-Z0-9.]',
            '',
            'g'
        )
    )
{% endmacro %}
