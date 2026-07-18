# Commands

## Purpose

The **Commands** module serves as the Discord entry point into the UmaKraft system.

Commands receive user requests, validate command parameters, and forward the request to the appropriate department.

Commands do not perform business logic, retrieve external data, render images, or calculate statistics.

They act solely as the communication bridge between Discord users and the UmaKraft pipeline.

---

## Responsibilities

- Receive Discord slash commands.
- Validate command parameters.
- Forward requests to the appropriate workflow.
- Return the completed result to Discord.
- Handle user-facing responses and errors.

---

## Does Not Do

Commands must **never**:

- Retrieve data from the uma.moe API.
- Calculate statistics.
- Process business logic.
- Render images.
- Build products.
- Store data.
- Validate trusted data.

These responsibilities belong to their respective departments.

---

## Input

- Discord Slash Commands
- User Parameters

---

## Output

- Product Requests
- User Responses
- Rendered Deliverables

---

## Workflow

```text
Discord User
      │
      ▼
   Command
      │
      ▼
UmaKraft Pipeline
      │
      ▼
Completed Product
      │
      ▼
Discord Response
```

---

# Available Commands

## `/fan_gain`

### Purpose

Generates a fan gain report for a trainer.

### Input

- Trainer Identifier

### Output

- Fan Gain Report

### Workflow

```text
Discord
    │
    ▼
/fan_gain
    │
    ▼
Request Fan Gain Product
    │
    ▼
Workshop
    │
    ▼
Discord Response
```

---

## `/profile`

### Purpose

Generates a complete trainer profile.

### Input

- Trainer Identifier

### Output

- Trainer Profile

### Workflow

```text
Discord
    │
    ▼
/profile
    │
    ▼
Request Profile Product
    │
    ▼
Workshop
    │
    ▼
Discord Response
```

---

## `/circle`

### Purpose

Displays information about a trainer's circle.

### Input

- Circle Identifier

### Output

- Circle Report

### Workflow

```text
Discord
    │
    ▼
/circle
    │
    ▼
Request Circle Product
    │
    ▼
Workshop
    │
    ▼
Discord Response
```

---

## `/set_fans`

### Purpose

Registers or updates the user's fan count used for tracking and comparisons.

### Input

- Fan Count

### Output

- Update Confirmation

### Workflow

```text
Discord
    │
    ▼
/set_fans
    │
    ▼
Update Fan Record
    │
    ▼
Confirmation
```

---

## `/link`

### Purpose

Links a Discord user to a Uma Musume trainer profile.

### Input

- Trainer Identifier

### Output

- Link Confirmation

### Workflow

```text
Discord
    │
    ▼
/link
    │
    ▼
Link Discord Account
    │
    ▼
Confirmation
```

---

## Design Principle

Commands are **entry points**, not business logic.

A command should only describe **what the user is requesting**, then delegate the request to the appropriate UmaKraft department.

The implementation details of data acquisition, processing, product assembly, rendering, and distribution remain the responsibility of the underlying pipeline.
