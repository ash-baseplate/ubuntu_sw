import GObject from "gi://GObject";
import GLib from "gi://GLib";
import St from "gi://St";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// Notification cooldown period (in seconds)
const NOTIFICATION_COOLDOWN = 30;

export default class BatteryNotifier extends Extension {
    enable() {
        this._lowBatteryNotified = false;
        this._notifyEnabled = true; // Notifications are enabled by default
        this._lastNotificationTime = 0; // Track the last notification time
        this._isCharging = false; // Track charging state

        // Create the panel indicator
        this._indicator = new PanelMenu.Button(0.0, "Battery Notifier", false);

        // Create the icon for the notification state (enabled by default)
        this._icon = new St.Icon({
            icon_name: 'notification-message-im', // fallback icon
            gicon: this._getCustomIcon(true), // use custom icon when enabled
            style_class: 'system-status-icon',
        });

        // Add the icon to the indicator
        this._indicator.add_child(this._icon);

        // Add toggle functionality for the notifications
        this._indicator.connect("button-press-event", () => this.toggleNotifications());

        // Start battery monitoring
        this._timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 30, () => { // Check battery every 12 seconds
                this._checkBatteryLevel();
                return GLib.SOURCE_CONTINUE;
            }
        );

        // Add indicator to the panel
        Main.panel.addToStatusArea(this.metadata.uuid, this._indicator, 0, "right");
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    _getCustomIcon(enabled) {
        const iconPath = `${this.path}/icons/${enabled ? 'on.png' : 'off.png'}`;
        const file = Gio.File.new_for_path(iconPath);
        return Gio.FileIcon.new(file);
    }

    toggleNotifications() {
        this._notifyEnabled = !this._notifyEnabled;

        if (this._notifyEnabled) {
            this._icon.gicon = this._getCustomIcon(true);
            Main.notify("Battery Notifier", "Notifications enabled");
        } else {
            this._icon.gicon = this._getCustomIcon(false);
            Main.notify("Battery Notifier", "Notifications disabled");
        }
    }
    _getBatteryInfo() {
        try {
            // Get the correct battery device path using `upower -e`
            const batteryDevicePath = GLib.spawn_command_line_sync("upower -e | grep 'battery_'")[1];
            if (!batteryDevicePath) {
                log("No battery device found.");
                return { level: 0, isCharging: false };
            }
    
            const batteryDevicePathStr = String(batteryDevicePath).trim();
            if (!batteryDevicePathStr) {
                log("Battery device path is empty.");
                return { level: 0, isCharging: false };
            }
    
            // Fetch the battery details using the device path
            const output = GLib.spawn_command_line_sync(`upower -i ${batteryDevicePathStr}`);
            const result = String(output[1]);
    
            // Check if the result is valid
            if (!result) {
                log("Error: No output from upower command.");
                return { level: 0, isCharging: false };
            }
    
            //Regex patterns to account for leading spaces and ensure correct matching
            const levelMatch = result.match(/percentage:\s+(\d+)%/);
            const stateMatch = result.match(/state:\s+(\w+)/);

            log(levelMatch + stateMatch); // Log the output for debugging
            if (!levelMatch || !stateMatch) {
                return { level: 0, isCharging: false }; // Default values if unable to parse
            }
    
            const level = parseInt(levelMatch[1], 10);
            const isCharging = stateMatch[1].trim() === "charging"; // Trim any whitespace
    
            return { level, isCharging };
        } catch (error) {
            log("Error getting battery info: " + error); // Log any errors
            return { level: 0, isCharging: false }; // Default values if there's an error
        }
    }
    
    _checkBatteryLevel() {
        const batteryInfo = this._getBatteryInfo();
        const batteryLevel = batteryInfo.level;
        const isCharging = batteryInfo.isCharging;

        if (this._notifyEnabled) {
            const now = GLib.get_monotonic_time() / 1000000; // Current time in seconds

            if (now - this._lastNotificationTime >= NOTIFICATION_COOLDOWN) {
                if (batteryLevel < 40 && !isCharging) {
                    Main.notify("Battery Low", "Battery level is below 40%. Please plug in your charger.");
                    this._lastNotificationTime = now;
                } else if (batteryLevel >= 80 && isCharging) {
                    Main.notify("Battery Full", "Battery level is above 80% please consider unplugging");
                    this._lastNotificationTime = now;
                }
            }
        }
    }
}
