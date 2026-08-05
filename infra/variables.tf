# AWS Configuration
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name (for SSO/Okta)"
  type        = string
  default     = "default"
}

# AWS Configuration (kept for reference, no longer used by Terraform)
# aws_region  = "us-west-2"
# aws_profile = "pokemon-app"

# Database Credentials (EC2 SQL Server)
variable "db_username" {
  description = "SQL Server username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "SQL Server password"
  type        = string
  sensitive   = true
}

variable "schema_name" {
  description = "Schema name"
  type        = string
  default     = "CLARITY"
}

# Fivetran Configuration
variable "fivetran_api_key" {
  description = "Fivetran API key"
  type        = string
  sensitive   = true
}

variable "fivetran_api_secret" {
  description = "Fivetran API secret"
  type        = string
  sensitive   = true
}

variable "fivetran_destination_id" {
  description = "Fivetran destination group ID for the Databricks Unity Catalog destination (jason_chletsos_databricks)"
  type        = string
}

# Fivetran Qualtrics Connector Configuration
variable "qualtrics_data_center" {
  description = "Qualtrics data center ID (e.g. \"iad1\"), found in the Qualtrics account URL just before qualtrics.com"
  type        = string
}

variable "qualtrics_client_id" {
  description = "Client ID for the Qualtrics OAuth client application, obtained from the Qualtrics API console when registering an OAuth client (or via Fivetran's connect-card OAuth flow)"
  type        = string
  sensitive   = true
}

variable "qualtrics_client_secret" {
  description = "Client secret for the Qualtrics OAuth client application, obtained from the Qualtrics API console when registering an OAuth client (or via Fivetran's connect-card OAuth flow)"
  type        = string
  sensitive   = true
}

variable "qualtrics_refresh_token" {
  description = "Long-lived OAuth refresh token issued for the Qualtrics OAuth client, obtained via Fivetran's connect-card OAuth flow or the Qualtrics API console"
  type        = string
  sensitive   = true
}
