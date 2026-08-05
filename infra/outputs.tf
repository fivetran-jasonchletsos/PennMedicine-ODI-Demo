# ============================================
# Outputs
# ============================================

# Fivetran Outputs
output "fivetran_connector_id" {
  description = "Fivetran connector ID"
  value       = fivetran_connector.healthcare_sqlserver.id
}

output "fivetran_connector_name" {
  description = "Fivetran connector name"
  value       = fivetran_connector.healthcare_sqlserver.name
}

output "fivetran_qualtrics_connector_id" {
  description = "Fivetran Qualtrics connector ID"
  value       = fivetran_connector.qualtrics.id
}

output "fivetran_workday_connector_id" {
  description = "Fivetran Workday HCM connector ID"
  value       = fivetran_connector.workday_hcm.id
}

output "fivetran_ukg_connector_id" {
  description = "Fivetran UKG Pro Workforce Management connector ID"
  value       = fivetran_connector.ukg_pro_workforce_management.id
}

output "sqlserver_host" {
  description = "EC2 SQL Server hostname"
  value       = var.sqlserver_host
}

output "sqlserver_database" {
  description = "SQL Server database name"
  value       = var.sqlserver_database
}
