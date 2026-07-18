# Building Umakraft UmaMoe (Node.js)

This repository contains modules for the Uma.moe -> Umakraft pipeline (Vault, Refiner, Compiler, Depot).

Prerequisites

- Node.js (>=16) and npm installed on your machine.

Quickstart

1. Install dependencies:

```powershell
npm install
```

2. Run tests:

```powershell
npm test
```

3. Use modules programmatically:

```javascript
const { Vault, refiner } = require('./index');
const vault = new Vault();
// vault.store(...)
```

Notes

- This project includes an in-memory Vault adapter for local development: `Umamoe/Vault/adapters/inmemory.js`.
- Tests use Mocha (configured in `package.json`). Install dev deps with `npm install` before running `npm test`.
