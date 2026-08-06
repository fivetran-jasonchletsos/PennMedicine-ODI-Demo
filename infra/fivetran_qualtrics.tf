# ============================================
# Fivetran Qualtrics Connector
# Pulls Qualtrics survey/experience data via OAuth
# Lands into the same shared Databricks Unity Catalog
# destination as the Epic Clarity SQL Server connector
# (group_id references a pre-existing Fivetran
# Databricks destination; not managed here)
# ============================================

resource "fivetran_connector" "qualtrics" {
  group_id = var.fivetran_destination_id
  service  = "qualtrics"

  destination_schema {
    name = "jason_chletsos_pennmed_qualtrics"
  }

  config {
    data_center = var.qualtrics_data_center
    auth_type   = "STANDARD"
    # Using a plain API token (Fivetran's schema still accepts this field,
    # marked deprecated in favor of OAuth, but functional) rather than the
    # client_id/client_secret/refresh_token OAuth flow - no OAuth app
    # registered for this shared dev Qualtrics tenant.
    api_token = var.qualtrics_api_token
  }
}
