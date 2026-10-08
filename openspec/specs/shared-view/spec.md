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
A room booking SHALL be displayed across both people's lanes and labelled with who booked it and its pax.

#### Scenario: Room spans lanes
- **WHEN** person A books a discussion room for 12–13
- **THEN** the 12–13 slot shows the room in both lanes, marked as booked by A

### Requirement: Cancelled bookings
Cancelled bookings SHALL be shown struck through and SHALL NOT produce overlap badges.

#### Scenario: Cancelled seat
- **WHEN** a seat booking's status is cancelled
- **THEN** it is shown struck through, and no overlap involving it is flagged

### Requirement: Overlap badges
The view SHALL flag time ranges where both people hold non-cancelled bookings. Intervals that only touch, where one ends exactly when the other starts, are not overlaps.
When one person's seat overlaps the other person's room, the view SHALL mark that seat as possibly redundant.
When both people hold rooms at overlapping times, the view SHALL mark both rooms as "duplicate room".

#### Scenario: Seat inside partner's room
- **WHEN** A holds a room 12–14 and B holds a seat 13–14
- **THEN** 13–14 is flagged, and B's seat is marked possibly redundant

#### Scenario: Both booked a room
- **WHEN** A holds a room 12–13 and B holds a different room 12–13
- **THEN** 12–13 is flagged, and both rooms are marked "duplicate room"

#### Scenario: Touching bookings
- **WHEN** A holds a seat 10–11 and B holds a seat 11–12
- **THEN** no overlap is flagged

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
