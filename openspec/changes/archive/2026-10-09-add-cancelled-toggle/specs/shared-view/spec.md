## MODIFIED Requirements

### Requirement: Cancelled bookings
Cancelled bookings SHALL be hidden by default (see "Cancelled visibility"). When shown, they SHALL be faded as a hollow outline with struck-through text, and the text SHALL remain readable (WCAG AA contrast). Cancelled bookings SHALL NOT produce overlap badges, whether shown or hidden.

#### Scenario: Cancelled seat
- **WHEN** a seat booking's status is cancelled and cancelled bookings are shown
- **THEN** it is shown as an unfilled, outlined block with struck-through text, and no overlap involving it is flagged

#### Scenario: Cancelled seat inside partner's room
- **WHEN** A holds a room 12–14 and B's seat 13–14 is cancelled
- **THEN** no overlap is flagged, and B's seat is not marked possibly redundant

## ADDED Requirements

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
