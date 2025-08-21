#!/bin/bash

# Detect the package manager and list user-installed packages (excluding dependencies and system libraries)

if command -v apt-mark &> /dev/null; then
    # Debian/Ubuntu and derivatives (e.g., Linux Mint)
    
    # Use dpkg-query to get only the main package names
    output=$(dpkg-query -f '${Package}\n' -W | grep -v '^lib')
    
    if [ -z "$output" ]; then
        echo "No manually installed packages found."
    else
        echo "$output"
    fi

elif command -v dnf &> /dev/null; then
    # Fedora, CentOS, RHEL
    
    # Use dnf to list user-installed packages and exclude 'lib*' packages
    output=$(dnf repoquery --userinstalled --qf '%{name}' | grep -v '^lib')
    
    if [ -z "$output" ]; then
        echo "No manually installed packages found."
    else
        echo "$output"
    fi

else
    echo "Unsupported or unknown package manager."
    exit 1
fi
