# ============================================
# Fivetran UKG Pro Workforce Management Connector
# Pulls employee/schedule/device workforce data via
# OAuth (client_credentials or ropc grant - both are
# machine-to-machine, obtained from UKG's own API
# console, no Fivetran dashboard OAuth popup needed).
# Lands into the same shared Databricks Unity Catalog
# destination as the Epic Clarity SQL Server connector
# (group_id references a pre-existing Fivetran
# Databricks destination; not managed here)
# ============================================

resource "fivetran_connector" "ukg_pro_workforce_management" {
  group_id = var.fivetran_destination_id
  service  = "ukg_pro_workforce_management"

  destination_schema {
    name = "jason_chletsos_pennmed_ukg"
  }

  config {
    auth_type        = var.ukg_auth_type
    organization     = var.ukg_organization
    auth_environment = var.ukg_auth_environment
    host_name        = var.ukg_host_name
    client_id        = var.ukg_client_id
    client_secret    = var.ukg_client_secret
    username         = var.ukg_username
    password         = var.ukg_password
  }
}
