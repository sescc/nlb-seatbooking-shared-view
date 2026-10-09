# shared-view Specification

## Purpose
Defines what the two people see on the secret shared page, which shows today's and tomorrow's seat and room bookings for both of them so they can avoid duplicate bookings, and how that page stays current.

## Requirements

### Requirement: Today and Tomorrow on one page
The view SHALL show Today and Tomorrow (Singapore time) stacked on one page, without tabs.
- Each day SHALL have a timeline with one lane per person, followed by a detail list.
- A day with no bookings SHALL show "No bookings".
- All times SHALL be shown in Singapore time, regardless of the viewer's device time zone.

#### Scenario: Both days visible
- **WHEN** person A has a booking today and person B has one tomorrow
- **THEN** both appear on the same page, in their respective day sections and lanes

#### Scenario: Device in another time zone
- **WHEN** the page is opened on a device set to UTC
- **THEN** a 14:00–15:00 SGT booking is displayed as 14:00–15:00

### Requirement: Consecutive hourly slots shown as one block
Consecutive bookings by the same person for the same seat or room, with the same status, where each ends exactly when the next starts, SHALL be displayed as one block.

#### Scenario: Four hourly rows
- **WHEN** a person holds seat S201 for 11–12, 12–13, 13–14 and 14–15
- **THEN** the timeline and the list show a single 11:00–15:00 S201 block

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

### Requirement: Cancelled bookings
Cancelled bookings SHALL be hidden by default (see "Cancelled visibility"). When shown, they SHALL be faded as a hollow outline with struck-through text, and the text SHALL remain readable (WCAG AA contrast). Cancelled bookings SHALL NOT produce overlap badges, whether shown or hidden.

#### Scenario: Cancelled seat
- **WHEN** a seat booking's status is cancelled and cancelled bookings are shown
- **THEN** it is shown as an unfilled, outlined block with struck-through text, and no overlap involving it is flagged

#### Scenario: Cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is cancelled
- **THEN** no overlap is flagged, and B's seat is not marked possibly redundant

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

### Requirement: Freshness indicators
Each person's lane SHALL show when their data was last received, as "pushed HH:MM (X min ago)", or "never pushed".
A non-cancelled booking that has not been checked in SHALL show an "unverified" badge when both hold:
- its check-in deadline (start + 15 minutes) has passed;
- the last push was received before that deadline.

#### Scenario: Deadline passed without a newer push
- **WHEN** a booking starts at 14:00, the last push was at 13:50, and it is now 14:15
- **THEN** that booking shows "unverified"

#### Scenario: Pushed after deadline
- **WHEN** the same booking was pushed again at 14:20 and is still not checked in
- **THEN** it does not show "unverified", because the push reflects NLB's state after the deadline

#### Scenario: Checked in
- **WHEN** a booking's status is checked in
- **THEN** it never shows "unverified"

### Requirement: Live updates while visible
While the page is visible, a new push SHALL appear within 5 seconds without a reload. While the page is hidden, it SHALL stop requesting updates, and it SHALL refresh immediately when it becomes visible again.

#### Scenario: Partner pushes
- **WHEN** B pushes while A has the page open
- **THEN** A's page shows B's new bookings within 5 seconds

#### Scenario: Hidden tab
- **WHEN** the page has been in a background tab
- **THEN** no update requests are made until it is shown again

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
- **THEN** B's seat is marked possibly redundant

#### Scenario: Partly cancelled seat with no overlap
- **WHEN** B's partly cancelled seat 10–11 does not intersect any booking of A
- **THEN** no badge is shown, and the seat is shown in B's faded colour

### Requirement: Notes column
Each row of the detail list SHALL show, in its Notes column, NLB's own wording for a cancelled booking, followed by any badges:
- cancelled: "Cancelled";
- partly cancelled: "Partially cancelled";
- no-show: "This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota."

Booked and checked-in rows SHALL show only their badges, if any.

#### Scenario: No-show note
- **WHEN** a booking is a no-show
- **THEN** its Notes cell reads "This booking has been cancelled as you did not check-in, 1 hour has been deducted from your daily quota."

#### Scenario: Booked row without badges
- **WHEN** a booking is booked, is verified, and overlaps nothing
- **THEN** its Notes cell is empty

#### Scenario: Note and badge together
- **WHEN** a partly cancelled seat is also marked possibly redundant
- **THEN** its Notes cell shows "Partially cancelled" followed by the "possibly redundant" badge

### Requirement: Cancelled visibility
The view SHALL hide cancelled bookings by default, from both the timeline and the list, and the timeline SHALL close up around them. The hour header and one lane per person SHALL always be drawn.
- A "Show cancelled" checkbox SHALL show cancelled bookings on both days. The choice SHALL be remembered on that browser only.
- Each day that has cancelled bookings SHALL show their count in its heading: "N cancelled hidden" while they are hidden, which reveals that day only, or "Hide N cancelled" while they are shown, which hides that day only. The count is of displayed blocks.
- A per-day reveal or hide SHALL last until the page is reloaded. Changing the checkbox SHALL reset every day to the checkbox's state.
- No-show and partly cancelled bookings SHALL never be hidden.

#### Scenario: Hidden by default
- **WHEN** a person has a cancelled seat 09–10 and a booked seat 11–12 tomorrow, and the checkbox has never been ticked
- **THEN** only the 11–12 seat is shown, and Tomorrow's heading reads "· 1 cancelled hidden"

#### Scenario: Reveal one day
- **WHEN** both days have cancelled bookings and the user clicks Tomorrow's "cancelled hidden" count
- **THEN** Tomorrow's cancelled bookings appear and its heading reads "· Hide N cancelled", while Today's stay hidden

#### Scenario: Checkbox resets per-day choices
- **WHEN** Tomorrow was revealed by its count, and the user then ticks and unticks "Show cancelled"
- **THEN** cancelled bookings are hidden on both days

#### Scenario: Only cancelled bookings
- **WHEN** every booking on a day is cancelled and hidden
- **THEN** the day still shows its hour header and lanes, "No active bookings", and the count in its heading

#### Scenario: No cancelled bookings
- **WHEN** a day has no cancelled bookings
- **THEN** its heading shows no count

#### Scenario: No-show stays visible
- **WHEN** a booking is a no-show and the checkbox is unticked
- **THEN** the no-show is still shown

#### Scenario: Reload
- **WHEN** the user ticked "Show cancelled", revealed nothing else, and reloads the page
- **THEN** cancelled bookings are still shown on both days

#### Scenario: Per-day reveal does not survive reload
- **WHEN** the checkbox is unticked, Tomorrow was revealed by its count, and the page is reloaded
- **THEN** Tomorrow's cancelled bookings are hidden again

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
