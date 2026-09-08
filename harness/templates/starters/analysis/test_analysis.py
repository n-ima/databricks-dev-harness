import json
from pathlib import Path
import sqlite3
import unittest
from analysis import analyze

class AnalysisContract(unittest.TestCase):
    def test_sql_python_parity(self):
        directory = Path(__file__).parent
        rows = json.loads((directory / "fixture.json").read_text())
        result = analyze(rows, "2026-01-01", "2026-01-03")
        self.assertEqual(result, [{"day": "2026-01-01", "quantity": 5}, {"day": "2026-01-02", "quantity": 4}])
        with sqlite3.connect(":memory:") as db:
            db.execute("CREATE TABLE approved_source (id TEXT, day TEXT, quantity INTEGER)")
            db.executemany("INSERT INTO approved_source VALUES (:id, :day, :quantity)", rows)
            sql = (directory / "fixture.sql").read_text()
            actual = [{"day": day, "quantity": total} for day, total in db.execute(sql, {"start_day": "2026-01-01", "end_day": "2026-01-03"})]
            self.assertEqual(actual, result)
    def test_boundaries(self):
        self.assertEqual(analyze([], "2026-01-01", "2026-01-02"), [])
        for rows in [
            [{"id": "x", "day": "2026-01-01", "quantity": None}],
            [{"id": "x", "day": "2026-01-01", "quantity": True}],
            [{"id": "x", "day": "2026-01-01", "quantity": 1}] * 2,
        ]:
            with self.assertRaises(ValueError):
                analyze(rows, "2026-01-01", "2026-01-02")
        with self.assertRaises(ValueError):
            analyze([], "2026-01-02", "2026-01-01")
    def test_reject_noncanonical_dates_before_sql_parity(self):
        for day in ["20260101", "2026-W01-4", "2026-1-1", "2026-02-30", None]:
            with self.subTest(day=day):
                with self.assertRaises(ValueError):
                    analyze([{"id": "x", "day": day, "quantity": 7}], "2026-01-01", "2026-01-03")
                with self.assertRaises(ValueError):
                    analyze([], day, "2026-01-03")
if __name__ == "__main__":
    unittest.main()
