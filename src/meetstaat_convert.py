"""Simple conversion helpers for MeetstaatConvertV1."""

from __future__ import annotations

from typing import Iterable


REQUIRED_COLUMNS = ("project", "item", "quantity", "unit")


def validate_row(row: dict) -> None:
    """Validate a single input row.

    Raises:
        ValueError: If required fields are missing or quantity is invalid.
    """
    missing = [column for column in REQUIRED_COLUMNS if column not in row or row[column] in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    try:
        quantity = float(row["quantity"])
    except (TypeError, ValueError) as exc:
        raise ValueError("quantity must be numeric") from exc

    if quantity < 0:
        raise ValueError("quantity must be >= 0")


def convert_rows(rows: Iterable[dict]) -> list[dict]:
    """Convert source rows into import-ready rows."""
    converted: list[dict] = []
    for index, row in enumerate(rows, start=1):
        try:
            validate_row(row)
        except ValueError as exc:
            raise ValueError(f"Row {index}: {exc}") from exc

        converted.append(
            {
                "project_code": str(row["project"]).strip().upper(),
                "description": str(row["item"]).strip(),
                "quantity": float(row["quantity"]),
                "uom": str(row["unit"]).strip().lower(),
            }
        )

    return converted
