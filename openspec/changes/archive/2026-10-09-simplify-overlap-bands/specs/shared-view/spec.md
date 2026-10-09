## MODIFIED Requirements

### Requirement: Overlap badges
When both people hold rooms at overlapping times, the view SHALL highlight that time range with a red band across the timeline and mark both rooms as "duplicate room". When one person's seat overlaps the other person's room, the view SHALL mark that seat as possibly redundant, without a band. Two people holding seats at the same time SHALL NOT be flagged. Intervals that only touch, where one ends exactly when the other starts, are not overlaps. Cancelled and no-show bookings never count.

#### Scenario: Seat inside partner's room
- **WHEN** A holds a room 12–14 and B holds a seat 13–14
- **THEN** B's seat is marked possibly redundant, and no band is drawn

#### Scenario: Both booked a room
- **WHEN** A holds a room 12–13 and B holds a different room 12–13
- **THEN** 12–13 is highlighted with a red band, and both rooms are marked "duplicate room"

#### Scenario: Both on seats at the same time
- **WHEN** A holds a seat 10–12 and B holds a seat 11–12
- **THEN** no band and no badge are shown

#### Scenario: Touching bookings
- **WHEN** A holds a seat 10–11 and B holds a seat 11–12
- **THEN** no overlap is flagged

#### Scenario: Touching rooms
- **WHEN** A holds a room 10–11 and B holds a room 11–12
- **THEN** no band and no "duplicate room" badge are shown

### Requirement: Partially cancelled bookings
A booking the person cancelled after it began SHALL be labelled "Partly cancelled", shown with a faded version of its person's colour, and SHALL still count for overlap badges.

#### Scenario: Partly cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is partly cancelled
- **THEN** B's seat is marked possibly redundant

#### Scenario: Partly cancelled seat with no overlap
- **WHEN** B's partly cancelled seat 10–11 does not intersect any booking of A
- **THEN** no badge is shown, and the seat is shown in B's faded colour

### Requirement: Key
The page SHALL offer a collapsible key under the subtitle that explains the booking styles (booked, checked in, partly cancelled, no-show, cancelled), the duplicate-room band and each badge. It SHALL be closed by default, and its open or closed state SHALL be remembered on that browser.

#### Scenario: First visit
- **WHEN** the page is opened for the first time on a browser
- **THEN** the key is closed

#### Scenario: Remembered
- **WHEN** the user opens the key and reloads the page
- **THEN** the key is open

#### Scenario: Items
- **WHEN** the key is open
- **THEN** it has no entries for rooms, the time line, the past shading or a yellow overlap band
