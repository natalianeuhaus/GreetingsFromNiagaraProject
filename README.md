# Greetings from Niagara — Website Interface v210

This package expands the existing v209 interactive map into a multi-page static website.                 
 
## Pages
- `index.html` — interactive map   
- `about.html`
- `history.html` 
- `voices.html`
- `share.html`
- `archive.html`
- `exhibitions.html`
- `contact.html`

## Shared files 
- `site.css` — website and menu styling 
- `site.js` — slide-out navigation
- `share.js` — story-method tabs and browser audio/video recording preview
- `style.css` — original interactive-map styling

## Submission status
The story interface is intentionally in preview mode. The browser recording tools work locally, but submissions are not transmitted or stored until a private form/media endpoint is connected. The notification email planned for that connection is:

GreetingsFromNiagara@gmail.com

Upload the contents of this folder to the GitHub Pages repository, not the ZIP itself.

## v211 refinements
- Map opens at the approved screenshot extent: center `[43.10275, -79.054]`, zoom `14`.
- The top-right website title uses the same Arial/bold family as the MENU label.
- Lower-right search, layers, center, and zoom controls now use the beige panel palette, borders, spacing, and typography.

## v212 refinements
- Opening map view matches the supplied screenshot:
  - center `[43.1117, -79.0396]`
  - zoom `12.75`
- `GREETINGS FROM NIAGARA` and `RAD Key Legend` use the same Arial bold typeface and tracking as the left MENU label.

## v213 refinements
- Updated the contact email to `GreetingsFromNiagara@gmail.com`.
- Added Instagram and page-sharing controls beneath Contact in the slide-out menu.
- Added the same follow/share controls to the Contact page.
- Added subtle hover and opening animations to the new menu, menu links, page buttons, and top-right map controls.

## v214 interaction stylesheet
- Added a separate `animations.css` file loaded after the existing stylesheets.
- Added hover motion to the right-side map controls and top-right labels.
- Added a rotating hover animation to the panel X.
- Added a gentle rightward movement to the collapsed `>` reopen control.
- Existing map data, layout, content, and primary stylesheets were not rewritten.

## v216 cache fix
- Replaced `animations.css` with the corrected v1.1 file.
- Updated every HTML page from `animations.css?v=1.0` to `animations.css?v=1.1`.
- This forces local browsers and GitHub Pages to load the new hover behavior.


## v216 interface fixes
- Keeps the full “GREETINGS FROM NIAGARA” title visible.
- Restores X-to-back-chevron hover feedback on left-side close controls.
- Restores the inverted x-ray hover on bottom-right map buttons.
