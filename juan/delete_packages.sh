#!/bin/bash

# Usage: ./delete_packages.sh <whitelist_file> [--dry-run]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <whitelist_file> [--dry-run]"
    exit 1
fi

WHITELIST_FILE="$1"
DRY_RUN=false
if [[ "$2" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# Load environment variables from .env
ENV_FILE="/home/juan/cdcs/deril/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Ensure dependencies
if ! command -v mongoexport &>/dev/null; then
    echo "Error: mongoexport not installed. Install with: sudo apt-get install mongo-tools"
    exit 1
fi
if ! command -v jq &>/dev/null; then
    echo "Error: jq not installed. Install with: sudo apt-get install jq"
    exit 1
fi

TMP_JSON=$(mktemp)

# Export new_packages from MongoDB flagged collection
mongoexport --uri="$MONGO_URI" -c flagged --type=json --fields new_packages --out "$TMP_JSON" --quiet

if [ ! -s "$TMP_JSON" ]; then
    echo "No flagged packages found in MongoDB."
    rm -f "$TMP_JSON"
    exit 0
fi

# Flatten JSON array into a unique list of packages
mapfile -t FLAGGED_PACKAGES < <(jq -r '.new_packages[]?' "$TMP_JSON" | sort -u)
rm -f "$TMP_JSON"

if [ ${#FLAGGED_PACKAGES[@]} -eq 0 ]; then
    echo "No flagged packages found in database."
    exit 0
fi

# Load whitelist
mapfile -t WHITELIST < "$WHITELIST_FILE"

# Determine unauthorized packages
TO_DELETE=()
for pkg in "${FLAGGED_PACKAGES[@]}"; do
    if [[ ! " ${WHITELIST[@]} " =~ " $pkg " ]]; then
        TO_DELETE+=("$pkg")
    fi
done

if [ ${#TO_DELETE[@]} -eq 0 ]; then
    echo "Nothing to delete. All flagged packages are either whitelisted or not installed."
    exit 0
fi

echo "Unauthorized packages detected:"
for pkg in "${TO_DELETE[@]}"; do
    echo " - $pkg"
done

if $DRY_RUN; then
    echo "Dry run: no packages removed."
else
    echo "Deleting unauthorized packages..."
    sudo apt-get remove --purge -y "${TO_DELETE[@]}"
    sudo apt-get autoremove -y
    echo "Deletion completed."
fi
