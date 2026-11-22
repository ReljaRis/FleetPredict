
import csv
import re

INPUT_FILE = "vehiclesdb-trucks-2026.11.12.csv"
OUTPUT_FILE = "eu_semi_trucks.csv"

# EU member countries (ISO 2-letter codes)
EU_COUNTRIES = {
    "at", "be", "bg", "hr", "cy", "cz", "dk",
    "ee", "fi", "fr", "de", "gr", "hu", "ie",
    "it", "lv", "lt", "lu", "mt", "nl", "pl",
    "pt", "ro", "sk", "si", "es", "se"
}

# Known European semi-truck model families
SEMI_TRUCK_MODELS = {
    "daf": [
        r"XF.*", r"XG.*", r"CF.*"
    ],
    "man": [
        r"TGX", r"TGA", r"TGS", r"F2000"
    ],
    "mercedes-benz": [
        r"Actros", r"Axor", r"SK",
        r"18\d{2}LS", r"184[0-9]"
    ],
    "volvo": [
        r"FH.*", r"FM", r"FM12", r"F12",
        r"F16", r"NH"
    ],
    "scania": [
        r"R.*", r"S\d+",
        r"S", r"G\d+",
        r"G Series", r"T\d+"
    ],
    "renault": [
        r"T", r"T High", r"T-Range",
        r"T\d+", r"Magnum", r"Premium"
    ],
    "iveco": [
        r"S-Way", r"Stralis", r"EuroStar",
        r"Eurotrakker"
    ],
    "ford": [
        r"F-Max"
    ]
}


def is_eu_market(row):
    countries = set(
        row["countries"].lower().split("|")
    )
    return bool(countries & EU_COUNTRIES)


def is_semi_truck(row):
    make = row["make_name"].strip().lower()
    model = row["model_name"].strip()

    patterns = SEMI_TRUCK_MODELS.get(make, [])

    return any(
        re.fullmatch(pattern, model, re.IGNORECASE)
        for pattern in patterns
    )


def main():
    with open(INPUT_FILE, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        trucks = [
            row for row in reader
            if is_eu_market(row) and is_semi_truck(row)
        ]

        fieldnames = reader.fieldnames

    trucks.sort(
        key=lambda x: (
            x["make_name"],
            x["model_name"]
        )
    )

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(trucks)

    print(f"Found {len(trucks)} EU semi-truck models")
    print(f"Saved to {OUTPUT_FILE}")

    for truck in trucks:
        print(
            truck["make_name"],
            truck["model_name"]
        )


if __name__ == "__main__":
    main()
