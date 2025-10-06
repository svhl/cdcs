#!/bin/bash
# delete_packages.sh
# Usage: ./delete_packages.sh <whitelist_file> [--dry-run]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <whitelist_file> [--dry-run]"
    exit 1
fi

whitelist_file="$1"
dry_run=false
if [[ "$2" == "--dry-run" ]]; then
    dry_run=true
fi

# === CONFIG ===
MONGO_URI=$(grep MONGO_URI /home/juan/cdcs/deril/.env | cut -d '=' -f2-)
DB_NAME="cdcs"
COLLECTION="flagged"
TMP_JSON="/tmp/mongo_packages.json"

# === DEPENDENCIES CHECK ===
if ! command -v mongoexport &>/dev/null; then
    echo "Error: mongoexport is not installed. Install with: sudo apt-get install mongo-tools"
    exit 1
fi
if ! command -v jq &>/dev/null; then
    echo "Error: jq is not installed. Install with: sudo apt-get install jq"
    exit 1
fi

# === STEP 1: Export flagged new_packages from MongoDB ===
mongoexport --uri="$MONGO_URI" -d "$DB_NAME" -c "$COLLECTION" \
    --type=json --fields new_packages --out "$TMP_JSON" --quiet

if [ ! -s "$TMP_JSON" ]; then
    echo "No flagged package data found in MongoDB."
    exit 0
fi

# === STEP 2: Parse JSON into unique package list ===
unauthorized_pkgs=$(jq -r '.new_packages[]?' "$TMP_JSON" | sort -u)

if [ -z "$unauthorized_pkgs" ]; then
    echo "No unauthorized packages found in MongoDB."
    exit 0
fi

# === STEP 3: Load whitelist ===
mapfile -t whitelist < "$whitelist_file"

# === STEP 4: Get list of actually installed packages ===
installed_pkgs=$(dpkg -l | awk '{print $2}' | tail -n +6)

# === STEP 5: Determine unauthorized installed packages ===
to_delete=()
for pkg in $unauthorized_pkgs; do
    if echo "$installed_pkgs" | grep -qw "$pkg"; then
        if [[ ! " ${whitelist[@]} " =~ " $pkg " ]]; then
            to_delete+=("$pkg")
        fi
    fi
done

# === STEP 6: Take action ===
if [ ${#to_delete[@]} -eq 0 ]; then
    echo "No unauthorized packages installed or all are whitelisted."
    exit 0
fi

echo "Unauthorized packages detected:"
for pkg in "${to_delete[@]}"; do
    echo " - $pkg"
done

if $dry_run; then
    echo "Dry run: no packages removed."
else
    echo "Deleting unauthorized packages..."
    sudo apt-get remove --purge -y "${to_delete[@]}"
    sudo apt-get autoremove -y
    echo "Deletion completed."
fi
