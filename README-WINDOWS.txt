Billing App - Windows Setup
============================

This folder is a self-contained copy of the billing app, including your
saved bills (data\bills\) and your Gemini API key (config.json). Just copy
this whole folder to the new laptop - no other files needed.

TO RUN:

  1. Double-click  start-windows.bat

  What it does:
    - Checks whether Node.js is installed.
    - If not, installs it automatically using winget (built into Windows
      10 version 1709+ and Windows 11). If winget isn't available, it
      opens the Node.js download page instead - install the LTS version,
      then run start-windows.bat again.
    - If Node.js was just installed, close and re-run the script once
      (Windows needs a fresh window to see the updated PATH).
    - Starts the server and opens http://localhost:3000 in your browser.

  To stop the server: close the Command Prompt window it opened, or press
  Ctrl+C inside it.

  To use a different port:
    set PORT=8080 && start-windows.bat

NOTES:

  - No login/auth - this app is meant for local, single-user use only.
  - Your bills are stored as one JSON file per bill in data\bills\ -
    back up that folder to keep your data safe.
  - config.json holds your Gemini API key. Don't share this folder
    publicly (e.g. upload it to a public repo or cloud drive) since it
    contains that key.
