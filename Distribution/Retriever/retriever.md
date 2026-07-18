# Distribution Retriever

## Purpose

This folder contains the Retriever layer for Distribution, responsible for fetching approved deliverables from the Workshop boundary.

## Responsibilities

- Read approved products from `Workshop/Terminal`.
- Provide a clean, read-only retrieval interface for Distribution.
- Handle lookup, resolution, and indexing of approved deliverables.
- Keep retrieval separate from Interaction and Delivery logic.

## Notes

- Retriever does not manufacture, validate, or deliver products.
- It only returns approved outputs to Distribution handlers.
- Use Retriever as the single source of approved product access.
