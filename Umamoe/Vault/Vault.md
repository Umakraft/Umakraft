# Vault

## Purpose

The **Vault** is responsible for storing and retrieving data that has successfully passed inspection.

It serves as the trusted data storage layer of the UmaMoe architecture.

Only data approved by the Inspector may enter the Vault.

The Vault preserves trusted information so that downstream departments, such as the Refinery, can retrieve and process it.

---

# Implementation Authority

This document is the authoritative specification for the implementation of `vault.js`.

The implementation must follow the responsibilities, boundaries, inputs, outputs, and restrictions defined in this document.

If a behavior is not defined in this specification, the implementation must not invent additional responsibilities for the Vault.

---

# Responsibilities

The Vault is responsible for:

1. Receiving accepted data from the Inspector.
2. Storing trusted data.
3. Retrieving stored data when requested by an authorized internal component.
4. Updating stored data when the system explicitly requires an update.
5. Removing data when an authorized cleanup operation requires removal.
6. Preserving the integrity of stored data.
7. Reporting storage failures clearly.

---

# Input

The Vault receives data that has successfully passed inspection.

The primary input must come from the Inspector.

```text id="w5f3z9"
Miner
    │
    ▼
Courier
    │
    ▼
Inspector
    │
    │ Accepted Data
    ▼
Vault
```

The Vault must not accept untrusted data directly from external APIs or unrelated components.

---

# Trusted Data Boundary

Data entering the Vault is considered trusted according to the inspection rules defined by the Inspector.

The Vault must not assume responsibility for performing the Inspector's validation process again.

However, the Vault must protect the integrity of the data it stores.

The Vault must not silently alter stored information.

---

# Storage Responsibilities

The Vault must provide a reliable mechanism for storing trusted data.

The storage implementation may use an approved storage method such as:

* Database storage.
* Local persistent storage.
* Structured files.
* Another approved persistence system.

The selected storage method must follow the project's architecture and configuration.

Storage details should be organized so that the underlying storage method can be changed without requiring the entire UmaMoe pipeline to be rewritten.

---

# Retrieval

The Vault must provide a clear method for retrieving trusted data.

Downstream departments may request data from the Vault through an approved interface.

For example:

```text id="0v0xk3"
Refinery
    │
    │ Request Trusted Data
    ▼
Vault
    │
    │ Return Stored Data
    ▼
Refinery
```

The Vault retrieves and returns stored data.

It must not calculate or interpret the meaning of the requested data.

---

# Data Integrity

The Vault must preserve stored information accurately.

The Vault must not:

* Change stored values without an authorized update.
* Add business calculations.
* Interpret data.
* Recalculate statistics.
* Transform data for presentation.
* Modify data simply because another department requires a different format.

If another department requires a different format, that transformation belongs to the appropriate downstream department.

---

# Updates

The Vault may update stored data when an authorized update operation is requested.

Updates must:

* Be intentional.
* Be clearly defined.
* Preserve data integrity.
* Avoid accidental overwriting of unrelated information.

The Vault must not independently invent new data or calculate replacement values.

---

# Deletion

The Vault may remove stored data only when an authorized deletion operation is performed.

Deletion must:

* Be intentional.
* Follow the project's data-retention rules.
* Avoid accidental deletion of unrelated data.

The Vault must not remove trusted data simply because it is unused at the moment.

---

# Error Handling

The Vault must handle storage failures safely.

The implementation must:

1. Detect failed storage operations.
2. Detect failed retrieval operations.
3. Detect failed update operations.
4. Detect failed deletion operations.
5. Report failures clearly.
6. Avoid silently claiming that an operation succeeded when it failed.

The Vault must preserve the original error information whenever possible.

---

# Separation of Responsibilities

The Vault must not perform responsibilities belonging to other departments.

## The Vault must not:

* Request data from the uma.moe API.
* Acquire external data.
* Transport data from the Miner to the Inspector.
* Perform data inspection.
* Calculate fan gains.
* Calculate rankings.
* Determine achievements.
* Determine milestones.
* Apply business logic.
* Generate reports.
* Create images.
* Create Discord embeds.
* Distribute products.

These responsibilities belong to other departments.

---

# Relationship with Inspector

The Inspector determines whether acquired data is acceptable for trusted storage.

The Vault stores the accepted data.

```text id="cr3cjm"
Inspector
    │
    │ Accepted Data
    ▼
Vault
    │
    │ Trusted Data
    ▼
Refinery
```

The Inspector is the gatekeeper.

The Vault is the trusted storage facility.

---

# Relationship with Refinery

The Refinery is a downstream consumer of trusted data stored in the Vault.

The Refinery may request data from the Vault through an approved interface.

The Vault provides the requested data without performing the Refinery's calculations or business logic.

```text id="5i2p9e"
Vault
    │
    │ Trusted Data
    ▼
Refinery
```

---

# Implementation Requirements for vault.js

The implementation of `vault.js` must:

* Provide a clear storage interface.
* Accept trusted data from the Inspector.
* Store trusted data persistently according to the project configuration.
* Provide retrieval methods for authorized downstream components.
* Support intentional updates where required.
* Support intentional deletion where required.
* Preserve stored data integrity.
* Clearly report storage failures.
* Avoid business logic.
* Avoid data analysis.
* Avoid external API acquisition.
* Avoid presentation logic.
* Avoid Discord-specific logic.
* Avoid distribution logic.

The implementation should separate storage operations from the rest of the application so that the storage system can evolve independently.

---

# Expected Implementation Boundary

The expected responsibility of `vault.js` is:

```text id="mtf4o4"
Receive Accepted Data
        │
        ▼
Store Trusted Data
        │
        ▼
Provide Trusted Data
        │
        ▼
Downstream Department
```

The implementation must stop at the trusted-storage boundary.

The Vault provides data.

The Refinery decides what to do with that data.

---

# Design Principle

> **The Vault preserves what has been trusted. It does not decide what the data means.**

The Vault is the trusted memory of the UmaMoe architecture.

Data enters only after passing through the Miner, Courier, and Inspector.

Once stored, the data becomes available to downstream departments without requiring those departments to communicate directly with the external uma.moe API.

---

# Implementation Rule

When creating or modifying `vault.js`, the implementation agent must:

1. Read this document completely.
2. Follow the responsibilities defined here.
3. Respect all prohibited responsibilities.
4. Preserve the boundaries between Inspector, Vault, and Refinery.
5. Avoid inventing undefined business logic.
6. Ask for clarification when a required storage behavior is missing instead of silently creating unrelated functionality.

The resulting `vault.js` must be an implementation of this specification, not an independent redesign of the Vault architecture.
