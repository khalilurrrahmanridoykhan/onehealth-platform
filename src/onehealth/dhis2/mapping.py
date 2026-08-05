import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class LocationMapping:
    uid: str
    name: str
    level: str


@dataclass(frozen=True, slots=True)
class DHIS2Mapping:
    disease_code: str
    disease_name: str
    data_set_uid: str
    cases_data_element_uid: str
    locations: dict[str, LocationMapping]
    national_cases_data_element_uid: str | None = None
    period_type: str = "Weekly"
    deaths_data_element_uid: str | None = None
    national_deaths_data_element_uid: str | None = None

    @classmethod
    def from_path(cls, path: Path) -> "DHIS2Mapping":
        with path.open(encoding="utf-8") as handle:
            raw = json.load(handle)

        locations = {
            code: LocationMapping(
                uid=value["uid"], name=value["name"], level=value["level"]
            )
            for code, value in raw["locations"].items()
        }
        return cls(
            disease_code=raw["diseaseCode"],
            disease_name=raw["diseaseName"],
            data_set_uid=raw["dataSetUid"],
            cases_data_element_uid=raw["casesDataElementUid"],
            locations=locations,
            national_cases_data_element_uid=raw.get("nationalCasesDataElementUid"),
            period_type=raw.get("periodType", "Weekly"),
            deaths_data_element_uid=raw.get("deathsDataElementUid"),
            national_deaths_data_element_uid=raw.get("nationalDeathsDataElementUid"),
        )

    def cases_uid_for_location(self, location: LocationMapping) -> str:
        if location.level == "national" and self.national_cases_data_element_uid:
            return self.national_cases_data_element_uid
        return self.cases_data_element_uid

    def deaths_uid_for_location(self, location: LocationMapping) -> str | None:
        if location.level == "national" and self.national_deaths_data_element_uid:
            return self.national_deaths_data_element_uid
        return self.deaths_data_element_uid

    def location_for_code(self, code: str) -> LocationMapping:
        try:
            return self.locations[code]
        except KeyError as exc:
            raise ValueError(f"No DHIS2 organization-unit mapping for {code}") from exc

    def code_for_uid(self, uid: str) -> str:
        for code, location in self.locations.items():
            if location.uid == uid:
                return code
        raise ValueError(f"No local location mapping for DHIS2 organization unit {uid}")
