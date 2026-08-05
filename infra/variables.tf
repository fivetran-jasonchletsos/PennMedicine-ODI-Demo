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
  description = "Fivetran destination group ID for MDLS"
  type        = string
}
