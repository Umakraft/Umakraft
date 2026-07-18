# Distribution Delivery

## Purpose

This folder contains the delivery layer responsible for formatting and sending approved deliverables to end users.

## Responsibilities

- Transform approved distribution outputs into channel-specific response payloads.
- Send or attach deliverables through the chosen delivery path.
- Handle message formatting, embeds, attachments, and response payload composition.
- Keep delivery logic separate from interaction request handling and retrieval.

## Notes

- Delivery does not manufacture, validate, or alter products.
- It depends on `Retriever` for approved product access.
- Interaction handlers should pass retrieved results into Delivery.
