# Distribution Contracts

## Purpose

This folder defines shared request and response schemas, types, and payload contracts used by Distribution.

## Responsibilities

- Document Distribution request and response structures.
- Define payload shape expectations for Interaction, Retriever, Delivery, and Adapters.
- Provide a shared contract reference for implementation code.
- Promote compatibility and consistency across distribution components.

## Notes

- Contracts are documentation and schema definitions; they do not contain business logic.
- Implementation code should reference these contracts to avoid incompatible payloads.
- Use contracts to standardize error and success payloads.
