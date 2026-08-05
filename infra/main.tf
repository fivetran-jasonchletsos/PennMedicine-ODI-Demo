terraform {
  required_version = ">= 1.0"

  required_providers {
    fivetran = {
      source  = "fivetran/fivetran"
      version = "~> 1.1"
    }
  }
}

provider "fivetran" {
  api_key    = var.fivetran_api_key
  api_secret = var.fivetran_api_secret
}
