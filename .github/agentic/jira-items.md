## GH-72:
**Title** - Tooltip missing for long named collections
**Status:** PUSHED
**Link:** https://github.com/akineralkan/fetchy/issues/72
**Description:** When hovering over a long-named collection in the sidebar, a tooltip should show the full name of the collection, but it is not currently displaying.
**Steps to Reproduce:** Hover over a long-named collection in the sidebar.
**Acceptance Criteria:**
- Hovering over a collection name in the sidebar shows a tooltip with the full name.
- The same tooltip behavior applies to folders and requests with long names in the sidebar.

---

## GH-73:
**Title** - Unable to move a request to specific folder
**Status:** PUSHED
**Link:** https://github.com/akineralkan/fetchy/issues/73
**Description:** Users are unable to move a request to a specific folder. The "Move" option from the three-dot context menu should display available folders for the user to choose from. Additionally, drag-and-drop functionality for reordering/moving requests between folders should work correctly.
**Steps to Reproduce:** Create a request under a collection → click the three-dot menu on the request → click "Move" → expected: folders shown → actual: unable to move to a specific folder. Drag and drop also does not work.
**Acceptance Criteria:**
- The Move dialog/menu on a request shows all available folders/collections the request can be moved to.
- Selecting a destination moves the request correctly.
- Drag and drop works for moving requests between folders.

---

## GH-77:
**Title** - About Menu
**Status:** PUSHED
**Link:** https://github.com/akineralkan/fetchy/issues/77
**Description:** Add an "About Fetchy" menu/dialog to the application. It should display information including: app version, build date, operating system the app is built for, contributors, open source packages/versions/links, app license, and app description. Examples provided reference Google Earth Pro and Wireshark-style About dialogs.
