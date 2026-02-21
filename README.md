# MeetstaatConvertV1

Convert Excel to import format for Build systems.

## Backend tests

Run the Python unit tests:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

## Frontend preview

Start a local static server:

```bash
python -m http.server 4173
```

Open:

- `http://localhost:4173/frontend/`

The page lets you paste JSON rows and preview converted output in the browser.

In step **5) Kies eerste hoofdstukregel (anker)**, click **Bevestig anker** to show the treeview.

## Current implementation

- `src/meetstaat_convert.py`: validates and converts source rows to an import-ready format.
- `tests/test_convert.py`: unit tests for successful conversion and validation errors.
- `frontend/index.html` + `frontend/main.js`: simple frontend preview for interactive conversion testing.
