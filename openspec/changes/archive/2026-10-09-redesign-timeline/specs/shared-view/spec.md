## MODIFIED Requirements

### Requirement: Rooms are shared
With two people, a room booking SHALL be drawn once, in its booker's colour, across the centre line between the two lanes, and labelled with who booked it and its pax. Each person's own row SHALL sit next to the centre line, and a booking SHALL move to an outer row only when it clashes in time with another booking in that row. When two rooms overlap in time, each SHALL be shown in its own booker's lane instead. With more than two people, rooms SHALL be shown in a shared "Rooms" band above the lanes.

#### Scenario: Room spans lanes
- **WHEN** person A books a discussion room for 12–13 and B has nothing at that time
- **THEN** the room is drawn once across the centre line in A's colour, marked as booked by A

#### Scenario: Partner's seat during the room
- **WHEN** A holds a room 12–14 and B holds a seat 13–14
- **THEN** the room still crosses the centre line and B's seat is shown in B's outer row

#### Scenario: Overlapping rooms
- **WHEN** A holds a room 16–17 and B holds a different room 16–17
- **THEN** neither crosses the centre line; each room is shown in its booker's own row next to the centre

#### Scenario: No clashes
- **WHEN** neither person has two bookings at the same time and there are no rooms
- **THEN** each person's lane is a single row

### Requirement: No-show bookings
A booking that NLB auto-cancelled because it was not checked in SHALL be labelled "No-show (auto-cancelled)" and shown in neutral grey with a dotted border, so it never resembles a person's colour. It SHALL NOT be struck through. It SHALL NOT produce overlap badges, because the seat or room is no longer held.

#### Scenario: No-show seat
- **WHEN** NLB reports a seat booking as auto-cancelled for no check-in
- **THEN** it is shown grey with a dotted border and the label "No-show (auto-cancelled)", not struck through

#### Scenario: No-show seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 was auto-cancelled for no check-in
- **THEN** no overlap is flagged, and B's seat is not marked possibly redundant

#### Scenario: No-show is never unverified
- **WHEN** a no-show booking's check-in deadline has passed and the last push predates it
- **THEN** it does not show "unverified"

### Requirement: Partially cancelled bookings
A booking the person cancelled after it began SHALL be labelled "Partly cancelled", shown with a faded version of its person's colour, and SHALL still count for overlap badges.

#### Scenario: Partly cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is partly cancelled
- **THEN** 13–14 is flagged, and B's seat is marked possibly redundant

#### Scenario: Partly cancelled seat with no overlap
- **WHEN** B's partly cancelled seat 10–11 does not intersect any booking of A
- **THEN** no overlap is flagged, and the seat is shown in B's faded colour

## ADDED Requirements

### Requirement: Current time
Today's timeline SHALL show a vertical line at the current Singapore time with an HH:MM label, between 08:00 and 22:00 only. It SHALL update at least every 30 seconds. Time already passed today SHALL be shaded, with every booking's text remaining readable (WCAG AA contrast). On a narrow screen, the first load SHALL scroll Today's timeline so the line is visible; later updates SHALL NOT move the user's scroll position.

#### Scenario: Afternoon
- **WHEN** it is 14:15 SGT
- **THEN** Today shows the line at 14:15 with a "14:15" label, and 08:00–14:15 is shaded

#### Scenario: Outside library hours
- **WHEN** it is 07:30 SGT
- **THEN** no line and no shading are shown

#### Scenario: Tomorrow
- **WHEN** the page shows Tomorrow
- **THEN** Tomorrow has no time line and no shading

#### Scenario: User has scrolled
- **WHEN** the user scrolled the timeline on a phone and the page refreshes
- **THEN** the scroll position is kept

### Requirement: Checked-in mark
A checked-in booking SHALL be marked with "✓" before its label on the timeline.

#### Scenario: Checked in
- **WHEN** a seat booking's status is checked in
- **THEN** its timeline label starts with "✓"

#### Scenario: Not checked in
- **WHEN** a seat booking's status is booked
- **THEN** its timeline label has no "✓"

### Requirement: Key
The page SHALL offer a collapsible key under the subtitle that explains each visual style: booking states, rooms, overlap and duplicate-room bands, each badge, and the time line and shading. It SHALL be closed by default, and its open or closed state SHALL be remembered on that browser.

#### Scenario: First visit
- **WHEN** the page is opened for the first time on a browser
- **THEN** the key is closed

#### Scenario: Remembered
- **WHEN** the user opens the key and reloads the page
- **THEN** the key is open
