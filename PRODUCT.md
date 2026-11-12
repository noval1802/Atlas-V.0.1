# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are Operator Pusdalops and Operator Kodam, on duty. Their job is to watch the monitoring map, then read or save the current situation for Kotamaops units. A Kodam operator is bound to one Kotamaops. Account administration supports that duty; it is not the primary job.

## Product Purpose

ATLAS — Advanced Tactical Location & Analytics System lets an operator on duty see the live monitoring map and keep the current situation of each Kotamaops. Success is a clear picture of what is happening and a saved current row the next operator can trust. The display name applies only to the map application in this repository.

## Positioning

The display name is ATLAS — Advanced Tactical Location & Analytics System. This map stays a separate deployment from the command center in `/home/localhost/Project/atlas`. Do not merge the repositories, ports, databases, cookies, or screens. Do not use the command center as a layout or interaction reference.

## Operating Context

The operator signs in at `/masuk`, watches the map at `/peta`, and works the situation board at `/operator`. User management is at `/pengguna`. Local development serves the app with `npm run dev` from this repository (see README).

## Capabilities and Constraints

Confirmed:

- Local username and password session. Operational screens use Indonesian.
- `/masuk`, `/operator`, and `/pengguna` keep Indonesian copy. The map stays at `/peta`.
- The situation board stores one current situation per Kotamaops. Status values are KONDUSIF, WASPADA, and SIAGA.
- Operator Pusdalops can read and write across units. Operator Kodam reads and writes only the bound unit.
- Portal labels in the product are Admin, Operator, Viewer, and Monitoring. Operators are the primary users of this record.

Undecided, and not to be invented:

- Whether unit crests and the karhutla figures are frozen design constraints. They are current operational content, not a visual theme.

## Brand Commitments

The display name is ATLAS — Advanced Tactical Location & Analytics System. Operational copy on `/masuk`, `/operator`, and `/pengguna` stays Indonesian. Internal identifiers, the cookie, and the database name stay as they are until a later phase. The eye mark (Eye of Horus) is retired: do not use it in the logo or new brand work. The ATLAS mark replaces it: `public/atlas-logo.svg` (animated tracks) and `public/favicon.svg` (simplified icon source for every favicon size). Do not take the command center as a visual reference.

## Evidence on Hand

- Running Next.js app in this repository, with routes `/masuk`, `/peta`, `/operator`, and `/pengguna`.
- Access rules in `docs/akses-endpoint.md` and `src/lib/ops/access.ts`.
- No `DESIGN.md` yet. The incumbent interface is the code and assets already in the app.
- The README describes ATLAS as an internal Pusdalops system and credits the upstream OSIRIS project. Do not fabricate customers, testimonials, or a public launch claim.

## Product Principles

- Design for the operator on duty: the map is for watching, the situation row is for the current state of a Kotamaops.
- This map stands on its own under the display name ATLAS. Do not borrow the command center's screens or visual language as the reference.
- Keep the operational routes and their Indonesian copy.
- One current situation per unit is the board's record. Do not turn that board into a second, unnamed command system.
