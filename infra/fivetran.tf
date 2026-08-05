# ============================================
# Fivetran SQL Server Connector (EC2-based)
# Points at EC2 SQL Server with ehr_demo database
# ============================================

variable "sqlserver_host" {
  description = "EC2 SQL Server hostname"
  type        = string
  default     = "ec2-52-89-75-245.us-west-2.compute.amazonaws.com"
}

variable "sqlserver_database" {
  description = "SQL Server database name"
  type        = string
  default     = "ehr_demo"
}

resource "fivetran_connector" "healthcare_sqlserver" {
  group_id = var.fivetran_destination_id
  service  = "sql_server"

  destination_schema {
    prefix = "jason_chletsos_ehr_demo"
  }

  config {
    host          = var.sqlserver_host
    port          = "1433"
    user          = var.db_username
    password      = var.db_password
    database      = var.sqlserver_database
    update_method = "TELEPORT"
  }
}

