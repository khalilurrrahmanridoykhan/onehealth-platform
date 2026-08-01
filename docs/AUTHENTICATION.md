# Authentication and Roles

The application uses signed eight-hour bearer sessions and PBKDF2-SHA256 password hashes. No user or password is committed to the repository.

Roles are cumulative:

| Role | Access |
|---|---|
| Viewer | Protected EBS registry reads |
| Analyst | Viewer access and analytical workflow context |
| Responder | Analyst access and guarded Tracker writes |
| Admin | All application permissions |

Generate a user entry interactively:

```bash
python scripts/create_auth_user.py username --role viewer
```

Place one or more generated entries in `ONEHEALTH_AUTH_USERS` as a JSON array. Set `ONEHEALTH_AUTH_SECRET` to a random value of at least 32 characters. Keep both values in a secret manager or uncommitted environment file.

Authentication does not automatically enable EBS data access. `ONEHEALTH_EBS_READS_ENABLED` and `ONEHEALTH_EBS_WRITES_ENABLED` remain independent safety switches. Use HTTPS in every non-local deployment; browser storage cannot protect a bearer token from a successful cross-site scripting attack.
