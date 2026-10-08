# Spec Delta

## Purpose

Defines how a person's own NLB seat and room bookings travel from the logged-in NLB page to the shared board, and which pushes are accepted, without any NLB credential ever leaving the user's browser.

## ADDED Requirements

### Requirement: Push only booking fields
A push SHALL contain only these per-booking fields: booking reference/id, seat or room name, area, floor, library, start, end, action codes and the room details field (pax and purpose).
It SHALL NOT contain the account holder's name, email, user id, account id or quota data.
Visit/day-pass bookings SHALL NOT be pushed.
The board SHALL NOT store a room's purpose text; only its pax is kept.

#### Scenario: Room purpose not stored
- **WHEN** a pushed room booking's details include a purpose text
- **THEN** the stored and displayed booking shows the pax but never the purpose text

### Requirement: Bookmarklet fits a mobile bookmark
The bookmarklet given on the setup page SHALL be at most 1,000 bytes long, so that mobile browsers that truncate long bookmark URLs can save it whole.

#### Scenario: Android bookmark
- **WHEN** a person copies their bookmarklet from the setup page into an Android Chrome bookmark
- **THEN** the whole bookmarklet fits within 1,000 bytes and runs unmodified

#### Scenario: Profile data stripped
- **WHEN** a logged-in user runs the push on the My Bookings page and NLB's account data includes name and email
- **THEN** the request received by the board contains bookings only, with no name, email or account identifiers

#### Scenario: Visit bookings excluded
- **WHEN** the user has a day-pass visit booking and a seat booking
- **THEN** only the seat booking is pushed

### Requirement: Push requires being logged in to NLB
The push SHALL read bookings using the user's existing NLB session in that browser.
It SHALL NOT send anything when no account data is available.

#### Scenario: Logged out
- **WHEN** the user runs the bookmarklet on the NLB page while logged out
- **THEN** a message asks them to log in, and nothing is sent to the board

### Requirement: Snapshot replace
An accepted push SHALL replace that person's previous bookings entirely.
An empty push SHALL clear that person's bookings.

#### Scenario: Cancellation disappears from active bookings
- **WHEN** a person pushes bookings A and B, then cancels B on NLB and pushes again
- **THEN** the board shows B as cancelled, or no longer shows B, and never as active

#### Scenario: Empty push
- **WHEN** a person pushes a list with no bookings
- **THEN** that person's lane shows no bookings

### Requirement: Reject invalid pushes
The board SHALL reject a push and leave the stored snapshot unchanged when:
- the push token is unknown (not-found response, indistinguishable from any unknown path);
- the payload is malformed;
- the payload is larger than 64 KB;
- the payload is not a list, or holds more than 200 bookings;
- the same person pushed less than 2 seconds earlier (too-many-requests response).

#### Scenario: Unknown token
- **WHEN** a push is sent with a token that matches no person
- **THEN** the response is a plain not-found, and no snapshot changes

#### Scenario: Oversized payload
- **WHEN** a push body exceeds 64 KB
- **THEN** it is rejected, and the previous snapshot remains

#### Scenario: Valid push from bookmarklet
- **WHEN** a valid push arrives as a form submission
- **THEN** the snapshot is stored, and the browser is redirected to the shared view with a "pushed" confirmation

#### Scenario: Valid push from userscript
- **WHEN** a valid push arrives as JSON
- **THEN** the snapshot is stored, and the response is an empty success

### Requirement: Server never contacts NLB
The board SHALL make no outbound network requests and SHALL store no NLB credentials, cookies or tokens.

#### Scenario: Push handling
- **WHEN** any push or view request is handled
- **THEN** no request is made from the server to any external host
