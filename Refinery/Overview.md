# Refinery Architecture Overview

## Purpose

The **Refinery** directory is responsible for transforming trusted information into finished products.

Unlike the **UmaMoe** directory, which focuses on acquiring, validating, and preserving information from external sources, the Refinery operates exclusively on trusted data retrieved from the Vault.

Its responsibility is to refine information through business logic, assemble complete products, and preserve those products until they are requested by the next stage of the UmaKraft architecture.

## Core Philosophy

Every department within the Refinery has **one responsibility and one responsibility only**.

Each department performs a specialized task without overlapping the responsibilities of another department. This separation keeps the architecture modular, predictable, maintainable, and easy to expand.

## Data Pipeline

```text
Vault
   │
   ▼
Refiner
   │
   ▼
Compiler
   │
   ▼
Depot
```

## Department Overview

### Refiner

Transforms trusted data into meaningful information by performing calculations, analysis, comparisons, and business logic.

### Compiler

Combines one or more refined results into complete, standardized products that are ready for storage.

### Depot

Stores completed products produced by the Compiler and preserves them until they are requested by the next architectural stage.

---

## Relationship with UmaMoe

The Refinery never communicates directly with external APIs.

All information entering the Refinery must originate from the **Vault**, ensuring that only trusted and validated information is processed.

The Refinery also does not deliver products to external systems. Its responsibility ends once completed products have been safely stored inside the **Depot**.

---

## Design Principle

The Refinery is responsible for **transforming information, not distributing it**.

Every finished product within the Depot has already been refined and compiled into a standardized structure, allowing downstream architectures to consume consistent and reliable products without needing to understand how they were created.

---

The Refinery serves as UmaKraft's production facility, transforming trusted information into finished products that are ready for the next stage of the system.
