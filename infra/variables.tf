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
# Defaults are blank so `terraform apply` can run before these are filled in
# (e.g. -target=fivetran_connector.healthcare_sqlserver to apply just the SQL
# Server connector while Qualtrics/Workday/UKG credentials are still pending).
variable "qualtrics_data_center" {
  description = "Qualtrics data center ID (e.g. \"iad1\"), found in the Qualtrics account URL just before qualtrics.com"
  type        = string
  default     = ""
}

variable "qualtrics_client_id" {
  description = "Client ID for the Qualtrics OAuth client application, obtained from the Qualtrics API console when registering an OAuth client (or via Fivetran's connect-card OAuth flow)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "qualtrics_client_secret" {
  description = "Client secret for the Qualtrics OAuth client application, obtained from the Qualtrics API console when registering an OAuth client (or via Fivetran's connect-card OAuth flow)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "qualtrics_refresh_token" {
  description = "Long-lived OAuth refresh token issued for the Qualtrics OAuth client, obtained via Fivetran's connect-card OAuth flow or the Qualtrics API console"
  type        = string
  sensitive   = true
  default     = ""
}

# Fivetran Workday HCM Connector Configuration
# auth_mode = "BASIC" uses username/password (a Workday Integration System User
# account, set up entirely in Workday's own admin console, no OAuth needed).
# auth_mode = "OAUTH" uses client_id/client_secret/refresh_token instead.
variable "workday_domain_host_name" {
  description = "Workday host name (e.g. wd5-impl-services1.workday.com), from your Workday tenant's API endpoint"
  type        = string
  default     = ""
}

variable "workday_tenant" {
  description = "Workday tenant name"
  type        = string
  default     = ""
}

variable "workday_auth_mode" {
  description = "Workday HCM auth mode: BASIC (Integration System User username/password) or OAUTH (client_id/client_secret/refresh_token)"
  type        = string
  default     = "BASIC"
}

variable "workday_integration_system_id" {
  description = "Workday Integration System ID (optional, scopes the connector to a specific Workday integration)"
  type        = string
  default     = ""
}

variable "workday_subscriber_id" {
  description = "WID of the Workday Integration Transaction Log Service subscriber (optional, speeds up history-table syncs)"
  type        = string
  default     = ""
}

variable "workday_username" {
  description = "Username of the Workday Integration System User account (used when workday_auth_mode = BASIC)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "workday_password" {
  description = "Password of the Workday Integration System User account (used when workday_auth_mode = BASIC)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "workday_client_id" {
  description = "Client ID of the Workday OAuth client app (used when workday_auth_mode = OAUTH)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "workday_client_secret" {
  description = "Client secret of the Workday OAuth client app (used when workday_auth_mode = OAUTH)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "workday_refresh_token" {
  description = "Long-lived OAuth refresh token for the Workday OAuth client (used when workday_auth_mode = OAUTH)"
  type        = string
  sensitive   = true
  default     = ""
}

# Fivetran UKG Pro Workforce Management Connector Configuration
# auth_type = "client_credentials" (machine-to-machine, no user login) or
# "ropc" (resource owner password credentials, needs username+password too).
# Both are obtained directly from UKG's own API/admin console - no Fivetran
# dashboard OAuth popup needed for either mode.
variable "ukg_auth_type" {
  description = "UKG Pro Workforce Management auth type: client_credentials or ropc"
  type        = string
  default     = "client_credentials"
}

variable "ukg_organization" {
  description = "UKG Pro Workforce Management Organization ID"
  type        = string
  default     = ""
}

variable "ukg_auth_environment" {
  description = "UKG Pro Workforce Management Auth base URL"
  type        = string
  default     = ""
}

variable "ukg_host_name" {
  description = "UKG Pro Workforce Management hostname"
  type        = string
  default     = ""
}

variable "ukg_client_id" {
  description = "UKG Pro Workforce Management client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ukg_client_secret" {
  description = "UKG Pro Workforce Management client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ukg_username" {
  description = "UKG Pro Workforce Management username (required by the connector schema regardless of auth_type)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ukg_password" {
  description = "UKG Pro Workforce Management password (required by the connector schema regardless of auth_type)"
  type        = string
  sensitive   = true
  default     = ""
}
