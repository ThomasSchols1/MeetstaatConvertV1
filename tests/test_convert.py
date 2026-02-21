import unittest

from src.meetstaat_convert import convert_rows


class ConvertRowsTests(unittest.TestCase):
    def test_convert_rows_success(self):
        rows = [
            {"project": "abc-1", "item": "Zand", "quantity": "2", "unit": "M3"},
            {"project": "abc-1", "item": "Beton", "quantity": 4.5, "unit": "M3"},
        ]

        result = convert_rows(rows)

        self.assertEqual(result[0]["project_code"], "ABC-1")
        self.assertEqual(result[0]["description"], "Zand")
        self.assertEqual(result[0]["quantity"], 2.0)
        self.assertEqual(result[0]["uom"], "m3")

    def test_convert_rows_missing_required_field(self):
        with self.assertRaisesRegex(ValueError, "Row 1: Missing required fields"):
            convert_rows([{"project": "abc-1", "quantity": 2, "unit": "m2"}])

    def test_convert_rows_invalid_quantity(self):
        with self.assertRaisesRegex(ValueError, "Row 1: quantity must be numeric"):
            convert_rows([{"project": "abc-1", "item": "Bestrating", "quantity": "x", "unit": "m2"}])


if __name__ == "__main__":
    unittest.main()
