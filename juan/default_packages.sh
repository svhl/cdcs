#!/bin/bash
# List user-installed Linux packages (excluding dependencies & whitelist)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHITELIST_FILE="$SCRIPT_DIR/default_packages.txt"

if [ ! -f "$WHITELIST_FILE" ]; then
    echo "whitelist file ($WHITELIST_FILE) not found!"
    exit 1
fi


if command -v apt-mark &> /dev/null; then
    # Debian/Ubuntu
    output=$(apt-mark showmanual)

    filtered=$(echo "$output" \
        | grep -Ev '^(lib|gir1\.|fonts-|python|gstreamer|linux-|xserver|mesa-|gnome-|kde-|qt[0-9]?|ubuntu|language-|task-)' \
        | grep -Fxv -f "$WHITELIST_FILE" \
        | sort)

    if [ -z "$filtered" ]; then
        echo "No user-level applications found."
    else
        echo "$filtered"
    fi

elif command -v dnf &> /dev/null; then
    # Fedora/RHEL
    if ! command -v repoquery &> /dev/null; then
        echo "repoquery not found. Please install dnf-plugins-core."
        exit 1
    fi

    output=$(dnf repoquery --userinstalled --qf '%{name}')

    filtered=$(echo "$output" \
        | grep -Ev '^(lib|python|gstreamer|fonts-|kernel-|mesa-|xorg-|gtk|gnome-|kde-|qt[0-9]?|language|desktop-|x11|adwaita|themes?|systemd|grub)' \
        | grep -Fxv -f "$WHITELIST_FILE" \
        | sort)

    if [ -z "$filtered" ]; then
        echo "No user-level applications found."
    else
        echo "$filtered"
    fi

else
    echo "Unsupported or unknown package manager."
    exit 1
fi
