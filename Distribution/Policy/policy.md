# Distribution Policy

## Purpose

This folder contains policy rules for access, permissions, and request handling within Distribution.

## Responsibilities

- Validate user permissions for requested deliverables.
- Apply delivery and request rate limits.
- Map channel users to the correct product access rights.
- Enforce security and distribution-level access policies.
- Provide reusable policy checks for Distribution components.

## Notes

- Policy is separate from Interaction, Retriever, and Delivery.
- It should export reusable checks for any distribution channel.
- Policy should be evaluated before retrieving or delivering content.
