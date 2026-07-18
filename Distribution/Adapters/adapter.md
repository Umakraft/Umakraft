# Distribution Adapters

## Purpose

This folder contains channel-specific delivery adapters for approved deliverables.

## Responsibilities

- Implement delivery adapters for channels such as Discord, webhook endpoints, and API consumers.
- Translate generic delivery payloads into channel-specific formats.
- Convert standardized distribution payloads into the destination channel's expected structure.
- Keep adapter logic isolated from core distribution workflows.

## Notes

- Adapters should depend on `Retriever`, `Delivery`, and `Contracts`, not on Workshop internals.
- Keep channel-specific formatting and transport details contained in this folder.
- Avoid embedding business rules in adapters.
