#!/bin/bash

installCursor() {
    local CURSOR_URL="https://downloader.cursor.sh/linux/appImage/x64"
    local ICON_URL="https://miro.medium.com/v2/resize:fit:700/1*YLg8VpqXaTyRHJoStnMuog.png"
    local APPIMAGE_PATH="/opt/cursor.appimage"
    local ICON_PATH="/opt/cursor.png"
    local DESKTOP_ENTRY_PATH="/usr/share/applications/cursor.desktop"

    echo "Checking for existing Cursor installation..."

    # Detect the user's shell
    local SHELL_NAME=$(basename "$SHELL")
    local RC_FILE=""

    case "$SHELL_NAME" in
        bash)
            RC_FILE="$HOME/.bashrc"
            ;;
        zsh)
            RC_FILE="$HOME/.zshrc"
            ;;
        fish)
            RC_FILE="$HOME/.config/fish/config.fish"
            ;;
        *)
            echo "Unsupported shell: $SHELL_NAME"
            echo "Please manually add the alias to your shell configuration file."
            return 1
            ;;
    esac

    # Notify if updating an existing installation
    if [ -f "$APPIMAGE_PATH" ]; then
        echo "Cursor AI IDE is already installed. Updating existing installation..."
    else
        echo "Performing a fresh installation of Cursor AI IDE..."
    fi

    # Install curl if not installed
    if ! command -v curl &> /dev/null; then
        echo "curl is not installed. Installing..."
        sudo apt-get update
        sudo apt-get install -y curl || { echo "Failed to install curl."; exit 1; }
    fi

    # Download AppImage and Icon
    echo "Downloading Cursor AppImage..."
    curl -L "$CURSOR_URL" -o /tmp/cursor.appimage || { echo "Failed to download AppImage."; exit 1; }

    echo "Downloading Cursor icon..."
    curl -L "$ICON_URL" -o /tmp/cursor.png || { echo "Failed to download icon."; exit 1; }

    # Move to final destination
    echo "Installing Cursor files..."
    sudo mv /tmp/cursor.appimage "$APPIMAGE_PATH"
    sudo chmod +x "$APPIMAGE_PATH"
    sudo mv /tmp/cursor.png "$ICON_PATH"

    # Create a .desktop entry
    echo "Creating .desktop entry..."
    sudo bash -c "cat > $DESKTOP_ENTRY_PATH" <<EOL
[Desktop Entry]
Name=Cursor AI IDE
Exec=$APPIMAGE_PATH --no-sandbox
Icon=$ICON_PATH
Type=Application
Categories=Development;
EOL

    # Add alias to the appropriate RC file
    echo "Adding cursor alias to $RC_FILE..."
    if [ "$SHELL_NAME" = "fish" ]; then
        # Fish shell uses a different syntax for functions
        if ! grep -q "function cursor" "$RC_FILE"; then
            echo "function cursor" >> "$RC_FILE"
            echo "    /opt/cursor.appimage --no-sandbox \$argv > /dev/null 2>&1 & disown" >> "$RC_FILE"
            echo "end" >> "$RC_FILE"
        else
            echo "Alias already exists in $RC_FILE."
        fi
    else
        if ! grep -q "function cursor" "$RC_FILE"; then
            cat >> "$RC_FILE" <<EOL
# Cursor alias
function cursor() {
    /opt/cursor.appimage --no-sandbox "\${@}" > /dev/null 2>&1 & disown
}
EOL
        else
            echo "Alias already exists in $RC_FILE."
        fi
    fi

    # Inform the user to reload the shell
    echo "To apply changes, please restart your terminal or run the following command:"
    echo "    source $RC_FILE"

    echo "Cursor AI IDE installation or update complete. You can find it in your application menu."
}

installCursor
