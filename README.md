
***

# 🎙️ MyDubList For Seanime

A plugin for **[Seanime](https://github.com/5rahim/seanime)** that adds a visual indicator to anime cards if a dub exists in your preferred language.

Powered by data from **[MyDubList](https://github.com/Joelis57/MyDubList)**.


## ✨ Features

*   **Language Support:** Supports over 25 languages (English, German, Spanish, French, Portuguese, etc.).
*   **Smart Positioning:** Automatically detects existing "Releasing" or "Next Episode" badges and positions itself either **beside** or **below** them based on your preference.
*   **Customizable Appearance:** Change the badge color (Indigo, Red, Green, Blue, Orange) to match your theme.
*   **Confidence Levels:** Filter dubs based on verification confidence (Low, Normal, High, Very High).
*   **Seamless Integration:** Works on Library, Discover, and Schedule pages (and their hover popups).

## 🚀 Installation

Use the Seanime Marketplace for the easiest installation.

Manual Install
1.  Navigate to **Settings** > **Extensions** in your Seanime application.
2.  Click on the **Add Extension** button.
3.  In the input field, paste the following manifest URL:
    ```
    https://raw.githubusercontent.com/Bas1874/anilist-discussion/main/src/manifest.json
    ```
4.  Click **Submit**. The plugin will be installed.
5.  After installation, Seanime will prompt you to grant the necessary permissions. Please review and accept them for the plugin to function correctly.

## ⚙️ Configuration

This plugin adds a **Tray Icon** to the Seanime interface. Click it to open the settings menu.

### Available Settings:

*   **Language:** Select the target language for dubs (Default: English).
*   **Confidence:** Select how strictly verified the dub data must be.
    *   *English default: Normal*
    *   *Other languages default: Low*
*   **Badge Position:**
    *   `Beside (Left)`: Places the badge to the left of existing badges.
    *   `Below`: Places the badge underneath existing badges.
*   **Badge Color:** Choose from Default (Indigo), Green, Red, Blue, or Orange.
*   **Debug Mode:** Shows the AniList ID in the tooltip instead of "Dubbed" for troubleshooting.

> **Note:** After changing settings, click the **"Save & Reload"** button in the tray to apply changes immediately without restarting the app.

## 🤝 Credits & Attribution

*   **Data Source:** [MyDubList](https://github.com/Joelis57/MyDubList) by [Joelis57](https://github.com/Joelis57).
    *   *License: CC BY 4.0*
*   **Platform:** [Seanime](https://github.com/5rahim/seanime) by [5rahim](https://github.com/5rahim).
