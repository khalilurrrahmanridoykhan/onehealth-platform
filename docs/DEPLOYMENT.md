# Controlled HTTPS Deployment

The production example runs FastAPI and the compiled dashboard as non-root, read-only containers. Caddy is the only public service and obtains HTTPS certificates automatically for a real DNS name.

## Prerequisites

- A Linux server with Docker Engine and the Compose plugin
- A DNS name pointing to the server
- Ports 80 and 443 available
- A controlled DHIS2 test instance and least-privilege API credential

## Configure

```bash
cp deploy/production.env.example .env.production
chmod 600 .env.production
export ONEHEALTH_DOMAIN=health.example.org
export DHIS2_DOMAIN=dhis2.example.org
export DHIS2_BOOTSTRAP_HASH='generated-caddy-password-hash'
```

Generate users with `scripts/create_auth_user.py`, use a secret manager where available, and never commit `.env.production`. Begin with EBS reads and writes disabled.

## Start and verify

```bash
docker compose -f compose.production.yml config
docker compose -f compose.production.yml build
docker compose -f compose.production.yml up -d
python scripts/verify_deployment.py https://health.example.org
```

Review container health and logs before enabling protected reads. Validate metadata and Tracker preview responses against test data before enabling writes. Back up Caddy volumes and manage host/firewall updates independently.

This configuration is a deployment baseline, not a substitute for an organizational security review, monitoring, backups, incident response, or DHIS2 governance.
