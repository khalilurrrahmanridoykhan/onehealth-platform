import re
from datetime import date, timedelta


LOCAL_WEEK = re.compile(r"^(?P<year>\d{4})-W(?P<week>\d{2})$")
DHIS2_WEEK = re.compile(r"^(?P<year>\d{4})W(?P<week>\d{1,2})$")


def local_week_to_dhis2(period_label: str) -> str:
    match = LOCAL_WEEK.fullmatch(period_label)
    if not match:
        raise ValueError(f"Invalid local weekly period: {period_label}")
    week = int(match.group("week"))
    year = int(match.group("year"))
    date.fromisocalendar(year, week, 1)
    return f"{year}W{week}"


def dhis2_week_bounds(period: str) -> tuple[date, date, str]:
    match = DHIS2_WEEK.fullmatch(period)
    if not match:
        raise ValueError(f"Invalid DHIS2 weekly period: {period}")
    year = int(match.group("year"))
    week = int(match.group("week"))
    start = date.fromisocalendar(year, week, 1)
    return start, start + timedelta(days=6), f"{year}-W{week:02d}"

