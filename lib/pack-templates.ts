/**
 * Worked examples for the written sections of a bid.
 *
 * These exist to show the shape and level of detail an evaluator scores
 * against — the guide's technical/functionality section is where points are
 * won, and a one-line answer scores like a blank one.
 *
 * They are inserted into the editor on request and then edited. Nothing here
 * is ever printed automatically: a pack must never go out carrying template
 * text, so an untouched section prints a visible placeholder instead.
 *
 * Written for a general supplier — government buys goods, Skrubb-it sources
 * and delivers them — rather than for a manufacturer of one product line.
 */

export const SAMPLE_PROFILE = `SKRUBB IT (PTY) LTD is a South African supplier of cleaning chemicals, hygiene consumables and general goods, based in Limpopo and delivering nationally. The company was registered in 2016 and manufactures its own range of cleaning products while also sourcing and supplying goods on demand for institutional and government clients.

Our core business is supply and delivery: we hold established relationships with manufacturers and wholesalers across several categories, which allows us to quote competitively on bulk requirements and to deliver within short lead times.

Capability
• Manufacturing of cleaning chemicals — dishwashing liquid, pine gel, bleach, toilet cleaner, fabric softener and floor care, in retail and bulk (5 L, 20 L, 25 L) sizes.
• Sourcing and supply of general goods, consumables, protective clothing and related items against a specification.
• Delivery to site, including offloading, throughout Limpopo and to other provinces by arrangement.

Compliance
The company is registered on the Central Supplier Database, is tax compliant with SARS, and holds a valid B-BBEE certificate. Full supporting documentation is enclosed with this bid.

[Replace the paragraphs above with your own wording. Add: years trading, staff complement, storage/warehouse capacity, delivery fleet, and any notable clients or contracts you can name.]`;

export const SAMPLE_METHODOLOGY = `1. Order confirmation
On award, we confirm the full order schedule with the department's contact person in writing within two working days, including quantities, pack sizes, delivery addresses and required delivery dates. Any discrepancy against the specification is raised before procurement begins.

2. Procurement and quality control
Goods we manufacture are produced to order against the specification. Goods we source are procured from established suppliers, and each consignment is inspected on receipt for quantity, pack integrity, labelling and expiry dating before it is accepted into our store.

3. Storage and preparation
Stock is held at our premises in conditions appropriate to the product and is picked and checked against the order schedule prior to dispatch. Each delivery is accompanied by a delivery note listing item, pack size and quantity.

4. Delivery and offloading
Deliveries are made to the addresses stated in the order, during the department's stated receiving hours, by our own vehicles or a contracted carrier. Our staff offload to the point specified by the receiving officer. The receiving officer signs the delivery note, and a copy is retained for invoicing and for the department's records.

5. Lead times
Standard lead time is [X] working days from written order for stocked items and [Y] working days for items sourced to specification. Urgent requirements are accommodated where possible by prior arrangement.

6. Shortfalls, damages and returns
Any item damaged in transit or short-delivered is replaced at our cost within [Z] working days of notification. Goods incorrectly supplied against the specification are collected and replaced at our cost.

7. Contract management and reporting
A single account manager is assigned as the department's point of contact for the duration of the contract. We provide a monthly summary of orders placed, delivered and outstanding, and are available for contract review meetings on request.

[Fill in the bracketed lead times with numbers you can actually meet — this is the section evaluators score most closely, and an undertaking you miss is a contract problem later.]`;

export const SAMPLE_EXPERIENCE = `The following contracts of a similar nature have been completed:

1. [Client / department name]
   Scope: [e.g. supply and delivery of cleaning chemicals and consumables]
   Value: [R amount]
   Period: [month/year to month/year]
   Contact: [name, position, telephone, email]

2. [Client / department name]
   Scope: [ … ]
   Value: [R amount]
   Period: [ … ]
   Contact: [name, position, telephone, email]

3. [Client / department name]
   Scope: [ … ]
   Value: [R amount]
   Period: [ … ]
   Contact: [name, position, telephone, email]

Reference letters on the clients' letterheads are enclosed where these have been provided.

[List real contracts only, most relevant first, and check that every contact person still holds that position and is willing to be called — evaluators do phone them, and a dead reference costs more points than a shorter list.]`;

export const SAMPLES = {
  profile: SAMPLE_PROFILE,
  methodology: SAMPLE_METHODOLOGY,
  experience: SAMPLE_EXPERIENCE,
} as const;
