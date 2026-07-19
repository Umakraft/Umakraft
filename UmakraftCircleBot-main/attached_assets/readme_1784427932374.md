# UmaMoe

## Overview

The `Umamoe` folder contains the UmaKraft data pipeline for fetching, validating, storing, and serving data from the `uma.moe` API.

This pipeline is organized as a set of specialized departments:

- `Miner` — fetches raw data from approved `uma.moe` endpoints
- `Courier` — transports data without modifying it
- `Inspector` — validates data structure, completeness, and integrity
- `Vault` — stores trusted data and provides retrieval/update/delete access

## Architecture

The UmaMoe pipeline is strictly linear:

```text
uma.moe API
   │
   ▼
Miner
   │
   ▼
Courier
   │
   ▼
Inspector
   │
   ▼
Vault


Each department has one responsibility only, and responsibilities do not overlap.

Key Documents
Use these documents as the authoritative specification for each part of the pipeline:

Umamoe/Overview.md — Architecture overview and department responsibilities
Umamoe/DATA_FORMAT.md — Trusted data structure and payload examples
Umamoe/MINER_ENDPOINTS.md — Approved uma.moe API endpoints
Umamoe/ERROR_HANDLING.md — Error classification and retry strategy
Umamoe/INTEGRATION_EXAMPLE.md — End-to-end happy path and failure scenarios
Umamoe/Inspector/VALIDATION_RULES.md — Validation rules for Inspector
Umamoe/Miner/Miner.md — Miner implementation contract
Umamoe/Courier/Courier.md — Courier implementation contract
Umamoe/Inspector/Inspector.md — Inspector implementation contract
Umamoe/Vault/Vault.md — Vault implementation contract
How to Use
Read Umamoe/Overview.md first.
Review Umamoe/DATA_FORMAT.md to understand the exact payload contract.
Use Umamoe/MINER_ENDPOINTS.md to determine which uma.moe endpoints are allowed.
Follow Umamoe/ERROR_HANDLING.md for consistent error reporting and retry behavior.
Use Umamoe/INTEGRATION_EXAMPLE.md to verify your implementation against real scenarios.
Implement each module using the corresponding department spec.
Recommended Workflow
Build or validate miner.js against Umamoe/Miner/Miner.md
Build or validate courier.js against Umamoe/Courier/Courier.md
Build or validate inspector.js against Umamoe/Inspector/Inspector.md
Build or validate vault.js against Umamoe/Vault/Vault.md
Run the full pipeline using the scenarios in Umamoe/INTEGRATION_EXAMPLE.md
Notes
The pipeline should never allow untrusted data into the Vault.
The Courier must not mutate payloads.
The Inspector must reject invalid payloads with clear rejection reasons.
The Vault must preserve raw data and metadata and keep storage implementation replaceable.
Next Steps
When you are ready, consider adding:

Umamoe/CONTRIBUTING.md — rules for extending the pipeline
Umamoe/ARCHITECTURE.md — deeper design and decision records
Umamoe/GETTING_STARTED.md — developer onboarding guide
This README is designed to be the first file someone reads when entering Umamoe.
