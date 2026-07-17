# Miner

## Purpose

The **Miner** department is responsible for retrieving raw information from the **uma.moe API**.

It acts as the project's data extractor, communicating directly with external endpoints and returning the response exactly as received.

Miner does **not** process, validate, modify, store, or distribute data. Its sole responsibility is to obtain information from the source.

## Responsibilities

* Connect to the uma.moe API.
* Request data from supported endpoints.
* Receive API responses.
* Return the retrieved data to the Courier department.

## Does Not Do

The Miner department must **never**:

* Validate data.
* Modify or transform data.
* Calculate statistics.
* Store data.
* Cache data.
* Handle business logic.
* Send Discord messages.

These responsibilities belong to other departments within the UmaMoe architecture.

## Input

* API endpoint
* Request parameters (if required)

## Output

* Raw API response

## Workflow

```text
Request
   │
   ▼
Miner
   │
   ▼
Raw API Response
   │
   ▼
Courier
```

## Design Principle

If the uma.moe API changes, only the Miner department should require modification.

All other departments should remain independent from external API implementation details.
