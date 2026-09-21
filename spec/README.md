# Workshop Specifications

These are the current machine and delivery contracts for the participant workshop.

## Authoritative Contracts

1. [Workshop delivery](workshop-delivery-contract.v1.json)
2. [Runtime](runtime-contract.v1.json)
3. [Experience](experience-contract.v1.json)
4. [OpenAPI](openapi.v1.yaml)
5. [Typed tools](tool-schemas.v1.json)
6. [FAI wiring](fai-manifest.json)
7. [Acceptance matrix](acceptance-matrix.md)

Supporting financial schemas, FOCUS mapping, rules, research, observability, and provider guidance remain under this folder.

The product source is under `src/`; contracts must be validated against source with:

```powershell
npm run validate:workshop
```

Documentation is not deployment evidence. Participant evidence, portal parity, model activation, hosted acceptance, screenshot review, and optional cleanup remain separate recorded states.
