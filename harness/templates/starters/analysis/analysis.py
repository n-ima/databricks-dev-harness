"""Local semantic fixture, not a forecast model or Spark runtime test."""
from datetime import date
import re

def canonical_day(value):
    # SQL compares canonical date strings. date.fromisoformat alone also accepts
    # compact/week dates on recent Python versions, which would break parity.
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("canonical YYYY-MM-DD required")
    return date.fromisoformat(value)

def analyze(rows, start, end):
    lower, upper = canonical_day(start), canonical_day(end)
    if lower >= upper:
        raise ValueError("start must precede exclusive end")
    seen, totals = set(), {}
    for row in rows:
        key, day, quantity = row["id"], canonical_day(row["day"]), row["quantity"]
        if not isinstance(key, str) or not key or key in seen:
            raise ValueError("non-empty unique id required")
        seen.add(key)
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 0:
            raise ValueError("non-negative integer quantity required")
        if lower <= day < upper:
            totals[day.isoformat()] = totals.get(day.isoformat(), 0) + quantity
    return [{"day": day, "quantity": totals[day]} for day in sorted(totals)]
