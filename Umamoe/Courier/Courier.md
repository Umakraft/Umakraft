# Courier

## Purpose

The **Courier** department is responsible for transporting information between departments within the UmaMoe architecture.

It does not create, modify, validate, or store data. Its only responsibility is to ensure that information reaches the correct destination.

Courier acts as the communication layer between departments, allowing each department to remain independent and focused on its own responsibility.

## Responsibilities

* Receive data from Miner.
* Deliver raw data to Inspector.
* Transport validated data between departments when required.
* Route information to the appropriate destination.

## Does Not Do

The Courier department must **never**:

* Request data from the API.
* Validate data.
* Modify data.
* Calculate statistics.
* Store data.
* Execute business logic.

Its responsibility is limited to transporting information.

## Input

* Raw or validated data from another department.

## Output

* The same data delivered to its intended department.

## Workflow

```text
Miner
   │
   ▼
Courier
   │
   ▼
Inspector
```

## Design Principle

Courier is a neutral messenger.

It treats every piece of information as a package. Its responsibility is to deliver the package safely and accurately without opening, modifying, or interpreting its contents.
