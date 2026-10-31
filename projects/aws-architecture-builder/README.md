# Cloud Brick Architect

A 2D brick-building game for AWS architecture. You snap AWS services (bricks) into Regions, VPCs, AZs and subnets (baseplates), then connect them.

- **Missions:** six missions, from a static website to a highly available web app and a GenAI RAG assistant, plus a sandbox.
- **Live checks:** each mission has goals, bonuses, a budget and up to three stars.
- **Run traffic:** animates the request path through your design.
- **Fail an AZ:** checks whether the design survives losing a data centre.
- **Icons:** 66 official [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/), used to create architecture diagrams as AWS intends.
- **Export:** PNG or JSON.

No build step:

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/
```

Docs: `docs/projects/aws-architecture-builder/`. This is an independent learning game, not affiliated with or endorsed by Amazon Web Services. Costs are game values, not AWS prices.
