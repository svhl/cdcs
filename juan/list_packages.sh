#!/bin/bash

# Script to list user-installed packages excluding dependencies

if command -v apt-mark &> /dev/null; then
    # Debian/Ubuntu
    echo "Detected apt (Debian/Ubuntu)"
    echo "User installed packages (excluding dependencies):"
    apt-mark showmanual

elif command -v dnf &> /dev/null; then
    # Fedora
    echo "Detected dnf (Fedora/RHEL)"
    echo "User installed packages (excluding dependencies):"
    dnf repoquery --userinstalled

elif command -v pacman &> /dev/null; then
    # Arch Linux
    echo "Detected pacman (Arch Linux)"
    echo "User installed packages (excluding dependencies):"
    pacman -Qe

elif command -v yum &> /dev/null; then
    # Older RHEL/CentOS with yum
    echo "Detected yum (CentOS/RHEL)"
    echo "User installed packages (excluding dependencies):"
    # yum doesn't have a direct way; this is a heuristic
    yumdb search reason user | awk '/^package:/ {pkg=$2} /^reason:/ {if ($2 == "user") print pkg}'

else
    echo "Unsupported or unknown package manager."
    exit 1
fi
