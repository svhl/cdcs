#!/bin/bash

# Detect the package manager and list top-level user-installed applications

if command -v apt-mark &> /dev/null; then
    # Debian/Ubuntu-based system

    # Get manually installed packages
    output=$(apt-mark showmanual)

    # Filter out likely non-GUI/system packages (simple heuristic)
    filtered=$(echo "$output" | grep -Ev '^(lib|gir1\.|fonts-|python|gstreamer|linux-|xserver|mesa-|gnome-|kde-|qt[0-9]?|ubuntu|language-|task-)' | sort)

    if [ -z "$filtered" ]; then
        echo "No user-level applications found."
    else
        echo "$filtered"
    fi

elif command -v dnf &> /dev/null; then
    # Fedora/RHEL-based system

    if ! command -v repoquery &> /dev/null; then
        echo "repoquery not found. Please install dnf-plugins-core."
        exit 1
    fi

    # List user-installed packages
    output=$(dnf repoquery --userinstalled --qf '%{name}')

    # Filter similarly to apt
    filtered=$(echo "$output" | grep -Ev '^(lib|python|gstreamer|fonts-|kernel-|mesa-|xorg-|gtk|gnome-|kde-|qt[0-9]?|language|desktop-|x11|adwaita|themes?|systemd|grub)' | sort)

    if [ -z "$filtered" ]; then
        echo "No user-level applications found."
    else
        echo "$filtered"
    fi

else
    echo "Unsupported or unknown package manager."
    exit 1
fi
