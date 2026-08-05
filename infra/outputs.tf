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

output "sqlserver_host" {
  description = "EC2 SQL Server hostname"
  value       = var.sqlserver_host
}

output "sqlserver_database" {
  description = "SQL Server database name"
  value       = var.sqlserver_database
}
