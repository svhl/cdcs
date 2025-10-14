#!/bin/bash

# Usage: ./delete_packages.sh <package1> <package2> ... [--dry-run]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <package1> <package2> ... [--dry-run]"
    exit 1
fi

# Check for --dry-run as the last argument
DRY_RUN=false
if [[ "${!#}" == "--dry-run" ]]; then
    DRY_RUN=true
    # Remove --dry-run from the list
    set -- "${@:1:$(($#-1))}"
fi

# All remaining arguments are packages to delete
PACKAGES=("$@")

if [ ${#PACKAGES[@]} -eq 0 ]; then
    echo "No packages specified for deletion."
    exit 0
fi

echo "Packages to delete:"
for pkg in "${PACKAGES[@]}"; do
    echo " - $pkg"
done

if $DRY_RUN; then
    echo "Dry run: no packages removed."
else
    echo "Deleting packages..."
    apt-get remove --purge -y "${PACKAGES[@]}"
    apt-get autoremove -y
    echo "Deletion completed."
fi
