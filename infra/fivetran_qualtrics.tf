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
    prefix = "jason_chletsos_pennmed_qualtrics"
  }

  config {
    data_center = var.qualtrics_data_center
    auth_type   = "STANDARD"
  }

  auth {
    client_access {
      client_id     = var.qualtrics_client_id
      client_secret = var.qualtrics_client_secret
    }
    refresh_token = var.qualtrics_refresh_token
  }
}
