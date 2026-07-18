# Distribution

This directory contains the user-facing delivery layer for approved deliverables.

## Purpose

Distribution exposes completed, validated products to the customer interaction layer.

## Responsibilities

- Receive requests from interaction channels (Discord, API, etc.).
- Retrieve approved deliverables from `Workshop/Terminal`.
- Deliver requested outputs to the user.
- Keep distribution logic separate from product manufacturing and validation.

## Notes

- The user-facing command should live in an interaction subdirectory, such as `Distribution/Interaction`.
- Distribution is responsible for delivery only; it should not perform calculations, validation, or product assembly.
- Use `Distribution/Retriever` to fetch approved deliverables from `Workshop/Terminal`.
- Use `Distribution/Delivery` to format and send channel-specific output.
- See `Distribution/Interaction/README.md` for shared interaction guidance.
- See `Distribution/Interaction/Discord/README.md` for Discord-specific interaction details.
- See `Distribution/Interaction/Discord/commands/commands.md` for the Discord command spec.
