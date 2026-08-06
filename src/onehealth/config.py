import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = PROJECT_ROOT / "data" / "processed" / "dengue_weekly.csv"
DEFAULT_DHIS2_MAPPING_PATH = PROJECT_ROOT / "dhis2" / "mappings" / "dengue.json"
DEFAULT_ENVIRONMENT_MONTHLY_PATH = (
    PROJECT_ROOT / "data" / "processed" / "environment" / "district_monthly.csv"
)
DEFAULT_ENVIRONMENT_SUMMARY_PATH = (
    PROJECT_ROOT / "data" / "processed" / "environment" / "district_summary.csv"
)


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false")


@dataclass(frozen=True, slots=True)
class DHIS2Settings:
    base_url: str
    api_token: str | None
    username: str | None
    password: str | None
    verify_ssl: bool
    timeout_seconds: float
    mapping_path: Path

    @classmethod
    def from_env(cls) -> "DHIS2Settings":
        base_url = os.environ.get("DHIS2_BASE_URL", "").strip()
        if not base_url:
            raise ValueError("DHIS2_BASE_URL is required when using the DHIS2 backend")

        api_token = os.environ.get("DHIS2_API_TOKEN", "").strip() or None
        username = os.environ.get("DHIS2_USERNAME", "").strip() or None
        password = os.environ.get("DHIS2_PASSWORD", "").strip() or None
        if not api_token and not (username and password):
            raise ValueError(
                "Set DHIS2_API_TOKEN or both DHIS2_USERNAME and DHIS2_PASSWORD"
            )

        return cls(
            base_url=base_url,
            api_token=api_token,
            username=username,
            password=password,
            verify_ssl=_env_bool("DHIS2_VERIFY_SSL", True),
            timeout_seconds=float(os.environ.get("DHIS2_TIMEOUT_SECONDS", "30")),
            mapping_path=Path(
                os.environ.get("DHIS2_MAPPING_PATH", DEFAULT_DHIS2_MAPPING_PATH)
            ),
        )
