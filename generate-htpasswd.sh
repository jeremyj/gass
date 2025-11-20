#!/bin/bash

# Script to generate .htpasswd file for Basic Authentication
# This file will be used by nginx-proxy for password protection

echo "=== GASS Basic Authentication Setup ==="
echo ""
echo "This will create a password-protected access to your GASS application."
echo ""

# Prompt for username
read -p "Enter username (default: gas): " USERNAME
USERNAME=${USERNAME:-gas}

# Prompt for password
read -s -p "Enter password: " PASSWORD
echo ""
read -s -p "Confirm password: " PASSWORD_CONFIRM
echo ""

# Check if passwords match
if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    echo "Error: Passwords do not match!"
    exit 1
fi

# Check if htpasswd is installed
if ! command -v htpasswd &> /dev/null; then
    echo ""
    echo "htpasswd is not installed. Installing apache2-utils..."

    # Detect OS and install
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y apache2-utils
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y httpd-tools
    else
        echo "Error: Unable to detect OS. Please install apache2-utils or httpd-tools manually."
        exit 1
    fi
fi

# Generate .htpasswd file
echo ""
echo "Generating .htpasswd file..."
htpasswd -cb .htpasswd "$USERNAME" "$PASSWORD"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! .htpasswd file created."
    echo ""
    echo "Username: $USERNAME"
    echo "File location: $(pwd)/.htpasswd"
    echo ""
    echo "⚠️  IMPORTANT: Keep this file secure and do not commit it to git!"
    echo ""
    echo "Next steps:"
    echo "1. Make sure .htpasswd is in .gitignore"
    echo "2. Update docker-compose.yml with your domain name"
    echo "3. Run: docker-compose up -d"
else
    echo ""
    echo "❌ Error: Failed to create .htpasswd file"
    exit 1
fi
