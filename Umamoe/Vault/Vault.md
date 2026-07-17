# Vault

## Purpose

The **Vault** department is responsible for securely storing and retrieving trusted information within the UmaMoe architecture.

Only data that has successfully passed inspection should be accepted into the Vault. It serves as the project's single source of truth, ensuring that stored information remains organized, consistent, and reliable.

## Responsibilities

* Store validated information.
* Retrieve stored information when requested.
* Update existing records.
* Remove obsolete records when necessary.
* Maintain data consistency.

## Does Not Do

The Vault department must **never**:

* Request data from the API.
* Transport data between departments.
* Validate incoming information.
* Process or calculate data.
* Execute business logic.
* Communicate with Discord.

## Input

* Validated information from the Inspector department.

## Output

* Stored records.
* Retrieved records requested by other departments.

## Workflow

```text
Inspector
    │
    ▼
  Vault
```

## Design Principle

The Vault is the project's **single source of truth**.

If information exists within the system, it should exist because it has been verified and securely stored in the Vault.
