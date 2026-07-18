# Terminal

## Purpose

The **Terminal** is the final stage of the Workshop and serves as the official departure point for approved deliverables.

It receives products that have successfully passed validation and makes them available to the Distribution directory.

The Terminal does not manufacture, modify, validate, or distribute deliverables. Its responsibility is to hold approved outputs at the boundary between the Workshop and Distribution.

## Responsibilities

* Receive approved deliverables from the Validator.
* Make approved deliverables available to Distribution.
* Maintain the handoff between the Workshop and Distribution.
* Preserve the integrity of approved deliverables until retrieval.
* Track the availability of deliverables awaiting distribution.

## Does Not Do

The Terminal must **never**:

* Retrieve data from external APIs.
* Perform calculations.
* Compile data products.
* Create product specifications.
* Manufacture deliverables.
* Validate deliverables.
* Deliver products to their final destination.

These responsibilities belong to other departments.

## Input

* Approved deliverables from the Validator.

## Output

* Approved deliverables ready for retrieval by Distribution.

## Workflow

```text id="w6l4qi"
Validator
    │
    ▼
Terminal
    │
    ▼
Distribution
```

## Design Principle

The Terminal marks the end of the Workshop.

A deliverable becomes the responsibility of Distribution only after it has passed validation and entered the Terminal.

This creates a clear boundary:

> The Workshop creates and approves the deliverable.
> The Terminal holds it for departure.
> Distribution delivers it to its destination.
> 
