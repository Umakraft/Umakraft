# Compiler

## Purpose

The **Compiler** department is responsible for assembling refined information into complete, standardized products.

It receives processed information from one or more Refiners, combines the required components into a unified structure, and stores the completed product in the Depot.

The Compiler does not perform calculations or deliver information. Its sole responsibility is to construct complete products from refined data.

## Responsibilities

* Receive refined information from the Refiner.
* Combine multiple refined results into a complete product.
* Build standardized output structures.
* Assemble reports, dashboards, profile objects, and other finished products.
* Store completed products in the Depot.

## Does Not Do

The Compiler department must **never**:

* Retrieve data from the uma.moe API.
* Calculate statistics or business logic.
* Validate data.
* Store trusted source data.
* Deliver products to external systems.
* Send Discord messages or notifications.

These responsibilities belong to other departments.

## Input

* Refined information from one or more Refiners.

## Output

* Fully compiled products ready for storage in the Depot.

## Workflow

```text
Refiner
    │
    ▼
Compiler
    │
    ▼
Depot
```

## Design Principle

The Compiler assembles, but never interprets.

Its responsibility is to combine refined information into complete and standardized products, ensuring every output follows a consistent structure before being stored in the Depot.
