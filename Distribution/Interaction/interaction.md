# Distribution Interaction

## Purpose

This folder contains channel-facing request handlers that coordinate approved deliverable retrieval and response delivery.

## Responsibilities

- Receive delivery requests from external channels such as Discord, API, or chat interfaces.
- Validate request parameters, user identity, and delivery permissions.
- Enforce Distribution policy before fetching data.
- Fetch approved deliverables from `Workshop/Terminal` via `Retriever`.
- Hand retrieved deliverables to `Delivery` for formatting and sending.
- Return safe, user-facing error responses when the request cannot be satisfied.

## Interaction contract

Interaction handlers should follow a request/response contract:

1. Accept an incoming request payload.
2. Validate the request and permission context.
3. Resolve the requested deliverable via `Retriever`.
4. If found, invoke `Delivery` with the approved output.
5. If not found or invalid, return a structured error.

### Example flow

*Discord command*:
- Receive command payload.
- Validate command parameters and user identity.
- Query `Retriever` for the approved deliverable.
- Use `Delivery` to build the Discord response.

*API request*:
- Receive HTTP request.
- Validate query/body parameters and authentication.
- Query `Retriever` for the requested item.
- Return a JSON payload or error response.

## Notes

- Interaction is read-only with respect to deliverables.
- It must not perform manufacturing, validation, or storage.
- It must not alter approved deliverables or product specifications.
- Use channel-specific subfolders for implementation details such as Discord command handlers or API routes.
- Prefer clear separation: `Interaction` handles requests, `Retriever` fetches data, and `Delivery` formats output.

## Folder structure guidance

- `Distribution/Interaction/Discord/` contains Discord-specific request handlers, commands, and command metadata.
- `Distribution/Interaction/API/` (or similar) should contain web/API handlers.
- Keep shared validation and policy logic in `Distribution/Policy/`.
- Keep shared response schemas in `Distribution/Contracts/`.
