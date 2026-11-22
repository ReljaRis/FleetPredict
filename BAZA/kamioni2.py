
import csv
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv


# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

API_KEY = os.getenv("SERPER_API_KEY")
API_URL = "https://google.serper.dev/search"

CSV_FILENAME = "eu_semi_trucks.csv"
OUTPUT_FILE = BASE_DIR / "fleetpredict_engines.jsonl"

# Safety limit for a single execution.
# Increase after testing and checking API credits.
MAX_REQUESTS = 100

# Maximum researched engines per truck.
MAX_ENGINES_PER_TRUCK = 3

# Maximum trucks processed in one run.
# Set to 0 to process all trucks.
MAX_TRUCKS = 0

REQUEST_DELAY = 1

session = requests.Session()
request_count = 0


# ==========================================
# ENGINE PATTERNS
# ==========================================

ENGINE_PATTERNS = {
    "volvo": [
        r"\bD(?:9|11|12|13|16)[A-Z]?\d{0,3}(?:TC)?\b"
    ],
    "scania": [
        r"\bD[CS](?:09|9|11|12|13|16)\s?\d{0,3}\b"
    ],
    "mercedes": [
        r"\bOM\s?(?:457|460|470|471|473|501|502|906|926)(?:\s?LA)?\b"
    ],
    "man": [
        r"\bD(?:08|15|20|26|28|38)\s?\d{2,4}\b"
    ],
    "daf": [
        r"\b(?:PACCAR\s?)?(?:MX|PX)[-\s]?(?:7|9|11|13)(?:\s?\d{2,3})?\b"
    ],
    "iveco": [
        r"\b(?:FPT\s?)?CURSOR\s?(?:8|9|10|11|13|16)\b",
        r"\bF3[A-Z0-9]{4,12}\b"
    ],
    "renault": [
        r"\bDTI\s?(?:5|8|11|13)\b",
        r"\bDE\s?(?:11|13)\b"
    ],
}


# ==========================================
# COMPONENTS TO RESEARCH
# ==========================================

COMPONENTS = {
    "turbocharger": "turbocharger turbo boost",
    "fuel_injectors": "fuel injectors",
    "high_pressure_fuel_pump": "high pressure fuel pump",
    "egr": "EGR valve cooler",
    "dpf": "DPF particulate filter",
    "scr_adblue": "SCR AdBlue system",
    "cooling_system": "water pump thermostat cooling",
    "crankshaft": "crankshaft bearings",
    "pistons_rings": "pistons piston rings",
    "camshaft_timing": "camshaft timing gears",
    "oil_pump": "oil pump lubrication",
    "engine_sensors": "engine sensors pressure temperature",
}


# ==========================================
# CSV LOADING
# ==========================================

def find_csv():
    locations = [
        BASE_DIR / CSV_FILENAME,
        BASE_DIR.parent / CSV_FILENAME,
        BASE_DIR / "BAZA" / CSV_FILENAME,
    ]

    for path in locations:
        if path.is_file():
            return path

    raise FileNotFoundError(
        f"Cannot find {CSV_FILENAME}. "
        "Place it next to the script or "
        "in the FleetPredict folder."
    )


def load_trucks():
    path = find_csv()

    trucks = []
    seen = set()

    with open(
        path, "r", encoding="utf-8-sig", newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            make = (row.get("make_name") or "").strip()
            model = (row.get("model_name") or "").strip()

            if not make or not model:
                continue

            key = (make.lower(), model.lower())

            if key in seen:
                continue

            seen.add(key)

            trucks.append({
                "make": make,
                "model": model,
                "name": f"{make} {model}",
                "countries": row.get("countries", ""),
            })

    return trucks


# ==========================================
# SERPER SEARCH
# ==========================================

class SearchLimitReached(Exception):
    pass


def search_web(query, count=10):
    global request_count

    if request_count >= MAX_REQUESTS:
        raise SearchLimitReached(
            "Search request limit reached."
        )

    request_count += 1

    response = session.post(
        API_URL,
        headers={
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "q": query,
            "num": count,
            "gl": "de",
            "hl": "en",
        },
        timeout=30,
    )

    if response.status_code in (401, 403):
        raise RuntimeError(
            "Invalid Serper API key or access denied."
        )

    if response.status_code == 429:
        raise SearchLimitReached(
            "Serper rate limit or credits reached."
        )

    response.raise_for_status()

    results = response.json().get("organic", [])

    time.sleep(REQUEST_DELAY)

    return [
        {
            "title": item.get("title", ""),
            "url": item.get("link", ""),
            "description": item.get("snippet", ""),
        }
        for item in results
    ]


# ==========================================
# MANUFACTURER DETECTION
# ==========================================

def get_manufacturer(make):
    make = make.lower()

    if "mercedes" in make:
        return "mercedes"

    if "paccar" in make:
        return "daf"

    for name in ENGINE_PATTERNS:
        if name in make:
            return name

    return None


def normalize_engine_code(code):
    code = re.sub(
        r"\s+", " ", code.upper()
    ).strip()

    code = re.sub(r"^OM\s+", "OM", code)

    return code


# ==========================================
# ENGINE DISCOVERY
# ==========================================

def discover_engines(truck):
    manufacturer = get_manufacturer(
        truck["make"]
    )

    if not manufacturer:
        return []

    name = truck["name"]

    queries = [
        f'"{name}" engine codes diesel specifications',
        f'"{name}" engine variants Euro VI Europe',
        f'"{name}" engine technical data horsepower',
    ]

    engines = {}

    for query in queries:
        print(f"    Searching: {query}")

        results = search_web(query)

        for result in results:
            content = (
                result["title"] + " " +
                result["description"]
            )

            for pattern in ENGINE_PATTERNS[manufacturer]:

                matches = re.finditer(
                    pattern,
                    content,
                    re.IGNORECASE
                )

                for match in matches:
                    code = normalize_engine_code(
                        match.group()
                    )

                    if not any(c.isdigit() for c in code):
                        continue

                    if code not in engines:
                        engines[code] = {
                            "engine_code": code,
                            "verification_status": "candidate",
                            "sources": [],
                            "components": {},
                        }

                    existing_urls = {
                        source["url"]
                        for source in engines[code]["sources"]
                    }

                    if (
                        result["url"]
                        and result["url"] not in existing_urls
                    ):
                        engines[code]["sources"].append(
                            result
                        )

    candidates = sorted(
        engines.values(),
        key=lambda engine: len(engine["sources"]),
        reverse=True
    )

    return candidates[:MAX_ENGINES_PER_TRUCK]


# ==========================================
# COMPONENT RESEARCH
# ==========================================

def research_component(
    truck,
    engine_code,
    component,
    keywords
):
    query = (
        f'{truck["make"]} "{engine_code}" '
        f'{keywords} parts specifications'
    )

    print(f"      Component: {component}")

    sources = search_web(query, count=5)

    return {
        "component_name": component,
        "status": (
            "candidate_sources_found"
            if sources else "not_found"
        ),
        "compatibility_verified": False,
        "oem_part_numbers": [],
        "sources": sources,
    }


# ==========================================
# TRUCK RESEARCH
# ==========================================

def research_truck(truck):
    print(f"\nResearching {truck['name']}")

    engines = discover_engines(truck)

    if not engines:
        print("  No engine candidates found.")

    for engine in engines:
        engine_code = engine["engine_code"]

        print(f"\n  Engine: {engine_code}")

        for component, keywords in COMPONENTS.items():
            engine["components"][component] = (
                research_component(
                    truck,
                    engine_code,
                    component,
                    keywords
                )
            )

    return {
        "truck": truck["name"],
        "manufacturer": truck["make"],
        "model": truck["model"],
        "countries": truck["countries"],
        "eu_market_verified": False,
        "researched_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "engine_count": len(engines),
        "status": (
            "candidates_found" if engines
            else "no_candidates_found"
        ),
        "engines": engines,
    }


# ==========================================
# SAVE / RESUME
# ==========================================

def load_completed():
    completed = set()

    if not OUTPUT_FILE.exists():
        return completed

    with open(
        OUTPUT_FILE, "r", encoding="utf-8"
    ) as file:

        for line in file:
            try:
                result = json.loads(line)
                completed.add(
                    result["truck"].lower()
                )
            except (ValueError, KeyError):
                continue

    return completed


def save_result(result):
    with open(
        OUTPUT_FILE, "a", encoding="utf-8"
    ) as file:

        file.write(
            json.dumps(
                result,
                ensure_ascii=False
            ) + "\n"
        )


# ==========================================
# MAIN
# ==========================================

def main():
    print("=" * 55)
    print("FLEETPREDICT - AUTOMATIC ENGINE RESEARCH")
    print("=" * 55)

    if not API_KEY:
        print(
            "ERROR: SERPER_API_KEY missing. "
            "Add it to your .env file."
        )
        return

    try:
        trucks = load_trucks()
    except (FileNotFoundError, KeyError) as error:
        print(f"CSV ERROR: {error}")
        return

    completed = load_completed()

    print(f"\nLoaded trucks: {len(trucks)}")
    print(f"Previously completed: {len(completed)}")
    print(f"Request budget: {MAX_REQUESTS}")

    processed = 0

    for index, truck in enumerate(trucks, start=1):
        if truck["name"].lower() in completed:
            continue

        if MAX_TRUCKS > 0 and processed >= MAX_TRUCKS:
            break

        print(
            f"\n[{index}/{len(trucks)}] "
            f"{truck['name']}"
        )

        try:
            result = research_truck(truck)

            save_result(result)
            completed.add(truck["name"].lower())
            processed += 1

        except SearchLimitReached as error:
            print(f"\nSTOPPED: {error}")
            print("Current truck was not saved.")
            break

        except (requests.RequestException, RuntimeError) as error:
            print(f"\nERROR: {error}")
            print("Current truck was not saved.")

            if isinstance(error, RuntimeError):
                break

            continue

    print("\n" + "=" * 55)
    print("RESEARCH SESSION FINISHED")
    print("=" * 55)

    print(f"Trucks processed this run: {processed}")
    print(f"API requests attempted: {request_count}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
