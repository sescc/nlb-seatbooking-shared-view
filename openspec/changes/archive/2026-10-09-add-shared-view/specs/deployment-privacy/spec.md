# Spec Delta

## Purpose

Defines how each deployment gets its own private URLs and push credentials without any being in the public source code, and how the deployment avoids being discovered by search engines or leaked through Referer headers.

## ADDED Requirements

### Requirement: Per-deployment secrets
The view secret and each person's push token and display name SHALL be configured per deployment and never stored in the source repository.
A provided command SHALL generate random secrets (at least 128 bits each) and install them into the deployer's own Cloudflare account.

#### Scenario: Fresh clone
- **WHEN** someone clones the public repository
- **THEN** it contains no view secret, push token, worker URL or person name

#### Scenario: Secret generation
- **WHEN** the deployer runs the secret-generation command with two names
- **THEN** a fresh view secret and two distinct push tokens are generated and installed, and the setup URL is printed

### Requirement: Setup page
`/setup/<view secret>` SHALL provide, for each person:
- a bookmarklet, as a draggable link and as copyable text for mobile;
- a userscript install link.

Both SHALL be pre-filled with this deployment's address and that person's push token.

#### Scenario: Bookmarklet targets this deployment
- **WHEN** person A copies their bookmarklet from the setup page
- **THEN** pushes made with it are attributed to A on this deployment

### Requirement: Not discoverable
Every response SHALL carry `X-Robots-Tag: noindex, nofollow, noarchive` and `Referrer-Policy: no-referrer`.
- `/robots.txt` SHALL disallow everything.
- The root path, unknown paths and wrong secrets SHALL return an identical bare not-found.
- Pages SHALL load no third-party resources.

#### Scenario: Wrong secret
- **WHEN** someone requests `/v/<wrong secret>`
- **THEN** the response is byte-identical to a request for any unknown path

#### Scenario: Crawler headers
- **WHEN** any page or API response is returned
- **THEN** it includes the noindex and no-referrer headers

### Requirement: View link is read-only
Knowing the view secret SHALL NOT allow pushing or changing bookings.

#### Scenario: Push with view secret
- **WHEN** a push is attempted using the view secret as the token
- **THEN** it is rejected as not-found
