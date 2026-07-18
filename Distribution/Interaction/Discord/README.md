# Distribution Interaction - Discord

This directory contains Discord-specific interaction handlers for the Distribution layer.

## Purpose

Handle Discord user requests for approved deliverables and deliver the requested content through Discord responses.

## Responsibilities

- Receive commands or interactions from Discord.
- Validate user permissions and request parameters.
- Query approved deliverables from `Workshop/Terminal`.
- Format the response for Discord (messages, embeds, attachments).
- Keep product retrieval and presentation logic separate from the core Workshop pipeline.

## Notes

- This directory is only for Discord-specific interaction code.
- The Discord handler should not perform product manufacturing, validation, or distribution storage.
- Prefer a clean request-response contract and safe error handling.
- Use `Distribution/Interaction/README.md` for shared interaction layer guidance.
- Refer to `commands/commands.md` for the official Discord command specification.
