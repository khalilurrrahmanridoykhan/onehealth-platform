import re
from datetime import date, timedelta


LOCAL_WEEK = re.compile(r"^(?P<year>\d{4})-W(?P<week>\d{2})$")
DHIS2_WEEK = re.compile(r"^(?P<year>\d{4})W(?P<week>\d{1,2})$")
LOCAL_SEMESTER = re.compile(r"^(?P<year>\d{4})-S(?P<semester>[12])$")
DHIS2_SEMESTER = re.compile(r"^(?P<year>\d{4})S(?P<semester>[12])$")
ANNUAL = re.compile(r"^(?P<year>\d{4})$")


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


def local_period_to_dhis2(period_label: str, period_type: str) -> str:
    if period_type.lower() == "weekly":
        return local_week_to_dhis2(period_label)
    if period_type.lower() in {"sixmonthly", "six_monthly", "semester"}:
        match = LOCAL_SEMESTER.fullmatch(period_label)
        if not match:
            raise ValueError(f"Invalid local six-monthly period: {period_label}")
        return f"{match.group('year')}S{match.group('semester')}"
    if period_type.lower() in {"yearly", "annual"}:
        match = ANNUAL.fullmatch(period_label)
        if not match:
            raise ValueError(f"Invalid local annual period: {period_label}")
        return match.group("year")
    raise ValueError(f"Unsupported DHIS2 period type: {period_type}")


def dhis2_period_bounds(period: str, period_type: str) -> tuple[date, date, str]:
    if period_type.lower() == "weekly":
        return dhis2_week_bounds(period)
    if period_type.lower() in {"sixmonthly", "six_monthly", "semester"}:
        match = DHIS2_SEMESTER.fullmatch(period)
        if not match:
            raise ValueError(f"Invalid DHIS2 six-monthly period: {period}")
        year = int(match.group("year"))
        semester = int(match.group("semester"))
        start = date(year, 1 if semester == 1 else 7, 1)
        end = date(year, 6, 30) if semester == 1 else date(year, 12, 31)
        return start, end, f"{year}-S{semester}"
    if period_type.lower() in {"yearly", "annual"}:
        match = ANNUAL.fullmatch(period)
        if not match:
            raise ValueError(f"Invalid DHIS2 annual period: {period}")
        year = int(match.group("year"))
        return date(year, 1, 1), date(year, 12, 31), str(year)
    raise ValueError(f"Unsupported DHIS2 period type: {period_type}")
