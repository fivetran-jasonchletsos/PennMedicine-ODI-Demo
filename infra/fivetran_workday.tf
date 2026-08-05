# ============================================
# Fivetran Workday HCM Connector
# Pulls worker/position/organization/recruiting data
# via BASIC (Integration System User) or OAUTH auth.
# Lands into the same shared Databricks Unity Catalog
# destination as the Epic Clarity SQL Server connector
# (group_id references a pre-existing Fivetran
# Databricks destination; not managed here)
# ============================================

resource "fivetran_connector" "workday_hcm" {
  group_id = var.fivetran_destination_id
  service  = "workday_hcm"

  destination_schema {
    prefix = "jason_chletsos_pennmed_workday"
  }

  config {
    domain_host_name      = var.workday_domain_host_name
    tenant                = var.workday_tenant
    auth_mode             = var.workday_auth_mode
    integration_system_id = var.workday_integration_system_id
    subscriber_id         = var.workday_subscriber_id
    # username/password only apply when auth_mode = "BASIC"
    username = var.workday_username
    password = var.workday_password
  }

  auth {
    # client_id/client_secret/refresh_token only apply when auth_mode = "OAUTH"
    client_id     = var.workday_client_id
    client_secret = var.workday_client_secret
    refresh_token = var.workday_refresh_token
  }
}
