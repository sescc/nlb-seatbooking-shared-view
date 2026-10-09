## MODIFIED Requirements

### Requirement: Cancelled bookings
Cancelled bookings SHALL be shown faded as a hollow outline with struck-through text, and SHALL NOT produce overlap badges. The text SHALL remain readable (WCAG AA contrast).

#### Scenario: Cancelled seat
- **WHEN** a seat booking's status is cancelled
- **THEN** it is shown as an unfilled, outlined block with struck-through text, and no overlap involving it is flagged

#### Scenario: Cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is cancelled
- **THEN** no overlap is flagged, and B's seat is not marked possibly redundant

## ADDED Requirements

### Requirement: No-show bookings
A booking that NLB auto-cancelled because it was not checked in SHALL be labelled "No-show (auto-cancelled)" and shown with a faded red tint that is less prominent than booked or checked-in bookings. It SHALL NOT be struck through. It SHALL NOT produce overlap badges, because the seat or room is no longer held.

#### Scenario: No-show seat
- **WHEN** NLB reports a seat booking as auto-cancelled for no check-in
- **THEN** it is shown red-tinted with the label "No-show (auto-cancelled)", not struck through

#### Scenario: No-show seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 was auto-cancelled for no check-in
- **THEN** no overlap is flagged, and B's seat is not marked possibly redundant

#### Scenario: No-show is never unverified
- **WHEN** a no-show booking's check-in deadline has passed and the last push predates it
- **THEN** it does not show "unverified"

### Requirement: Partially cancelled bookings
A booking the person cancelled after it began SHALL be labelled "Partly cancelled" and SHALL still count for overlap badges.

#### Scenario: Partly cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is partly cancelled
- **THEN** 13–14 is flagged, and B's seat is marked possibly redundant

#### Scenario: Partly cancelled seat with no overlap
- **WHEN** B's partly cancelled seat 10–11 does not intersect any booking of A
- **THEN** no overlap is flagged

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
