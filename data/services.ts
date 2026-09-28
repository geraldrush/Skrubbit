/**
 * Professional cleaning services.
 *
 * Kept in code, like the product categories: the list changes when the
 * business takes on a new kind of work, not when someone edits a catalogue.
 * Each service's `slug` is also what /contact?service= pre-fills the enquiry
 * with, so renaming one does not break links already sent to clients.
 */
export type ServiceGroup = {
  id: string;
  name: string;
  blurb: string;
};

export type Service = {
  slug: string;
  group: ServiceGroup["id"];
  name: string;
  summary: string;
  includes: string[];
};

export const serviceGroups: ServiceGroup[] = [
  {
    id: "specialist",
    name: "Deep & specialist cleaning",
    blurb: "Once-off, top-to-bottom work for when routine cleaning is not enough.",
  },
  {
    id: "commercial",
    name: "Commercial, corporate & industrial",
    blurb: "Workplaces, plants and premises — once-off or on a contract.",
  },
  {
    id: "sector",
    name: "Schools, clinics & hospitality",
    blurb: "Cleaning to the standard each kind of facility is held to.",
  },
  {
    id: "residential",
    name: "Residential",
    blurb: "Homes, rentals and complexes.",
  },
  {
    id: "exterior",
    name: "Exterior & surfaces",
    blurb: "Outside areas, floors, windows and fleets.",
  },
];

export const services: Service[] = [
  // --- Deep & specialist ---
  {
    slug: "deep-cleaning",
    group: "specialist",
    name: "Deep cleaning",
    summary:
      "A thorough, top-to-bottom clean that reaches what routine cleaning skips — behind and under fittings, inside cupboards and appliances, grout, vents and skirtings.",
    includes: [
      "Inside and behind appliances and fittings",
      "Grout, tiles and sanitary ware descaled",
      "Walls, doors, switches and skirtings washed",
      "Vents, light fittings and high surfaces dusted",
    ],
  },
  {
    slug: "heavy-duty-cleaning",
    group: "specialist",
    name: "Heavy-duty cleaning",
    summary:
      "For heavily soiled spaces — built-up grease, grime, stains and neglect — using industrial-strength degreasers and machine scrubbing.",
    includes: [
      "Degreasing of floors, walls and equipment",
      "Machine scrubbing of hard floors",
      "Stain and scale removal",
      "Removal of accumulated waste",
    ],
  },
  {
    slug: "post-construction-cleaning",
    group: "specialist",
    name: "Post-construction cleaning",
    summary:
      "The builders' clean that turns a finished site into a handover-ready building — dust, paint, plaster and cement residue removed.",
    includes: [
      "Builders' dust removed from every surface",
      "Paint, plaster and cement splashes lifted",
      "Windows, frames and tracks cleaned",
      "Rubble and packaging cleared",
    ],
  },
  {
    slug: "move-in-move-out-cleaning",
    group: "specialist",
    name: "Move-in / move-out cleaning",
    summary:
      "An end-of-lease or pre-occupation clean so a property is handed over, or moved into, spotless.",
    includes: [
      "Kitchen, bathrooms and cupboards inside and out",
      "Floors, walls and windows",
      "Stove, oven and fridge cleaned",
      "Ready for inspection",
    ],
  },
  {
    slug: "sanitising-and-disinfection",
    group: "specialist",
    name: "Sanitising & disinfection",
    summary:
      "Disinfection of high-touch surfaces and shared areas, as a scheduled service or after an illness outbreak on the premises.",
    includes: [
      "High-touch points: handles, rails, switches, counters",
      "Ablutions, kitchens and shared areas",
      "Fogging or spray application where suited",
      "Scheduled or once-off",
    ],
  },
  {
    slug: "carpet-and-upholstery-cleaning",
    group: "specialist",
    name: "Carpet & upholstery cleaning",
    summary:
      "Deep extraction cleaning of carpets, rugs, office chairs and couches to lift ingrained dirt, stains and odours.",
    includes: [
      "Carpets and rugs extraction-cleaned",
      "Office chairs and couches",
      "Spot and stain treatment",
      "Deodorising",
    ],
  },

  // --- Commercial, corporate & industrial ---
  {
    slug: "corporate-office-cleaning",
    group: "commercial",
    name: "Corporate & office cleaning",
    summary:
      "Daily, weekly or after-hours cleaning of offices, boardrooms, reception areas and staff kitchens, so the workplace is ready when people arrive.",
    includes: [
      "Desks, workstations and boardrooms",
      "Kitchens and ablutions cleaned and restocked",
      "Floors vacuumed and mopped",
      "Waste removed and bins lined",
    ],
  },
  {
    slug: "industrial-cleaning",
    group: "commercial",
    name: "Industrial cleaning",
    summary:
      "Cleaning of factories, warehouses, workshops and plants — floors, machinery surrounds, loading bays and high-traffic areas.",
    includes: [
      "Warehouse and factory floors scrubbed",
      "Oil, grease and spill clean-up",
      "Workshops and loading bays",
      "Done around your operating hours",
    ],
  },
  {
    slug: "contract-cleaning",
    group: "commercial",
    name: "Contract cleaning",
    summary:
      "An ongoing cleaning contract on an agreed schedule, with a fixed monthly price and the chemicals supplied by us.",
    includes: [
      "Agreed schedule and scope",
      "Fixed monthly price",
      "Our own chemicals and consumables",
      "One point of contact",
    ],
  },
  {
    slug: "retail-and-shop-cleaning",
    group: "commercial",
    name: "Retail & shop cleaning",
    summary:
      "Shop floors, shelving, fitting rooms, storerooms and shopfronts kept clean before trading hours.",
    includes: [
      "Shop floors and shelving",
      "Storerooms and back-of-house",
      "Shopfront glass",
      "Before or after trading hours",
    ],
  },
  {
    slug: "kitchen-and-canteen-cleaning",
    group: "commercial",
    name: "Kitchen & canteen cleaning",
    summary:
      "Degreasing and sanitising of commercial kitchens, canteens and food-preparation areas.",
    includes: [
      "Stoves, fryers and extractor hoods degreased",
      "Walls, floors and drains",
      "Cold rooms and storage",
      "Food-contact surfaces sanitised",
    ],
  },
  {
    slug: "event-cleaning",
    group: "commercial",
    name: "Event cleaning",
    summary:
      "Cleaning before, during and after functions, conferences, weddings and community events.",
    includes: [
      "Venue preparation",
      "Ablution attendants during the event",
      "Post-event clean-up and waste removal",
    ],
  },

  // --- Sector ---
  {
    slug: "school-and-institution-cleaning",
    group: "sector",
    name: "School & institution cleaning",
    summary:
      "Classrooms, halls, hostels and ablutions at schools, colleges and government buildings — including holiday deep cleans.",
    includes: [
      "Classrooms, halls and offices",
      "Hostels and dining halls",
      "Ablution blocks",
      "Holiday and term-start deep cleans",
    ],
  },
  {
    slug: "clinic-and-healthcare-cleaning",
    group: "sector",
    name: "Clinic & healthcare cleaning",
    summary:
      "Cleaning and disinfection of clinics, consulting rooms and waiting areas, with attention to infection-control routines.",
    includes: [
      "Consulting and treatment rooms",
      "Waiting areas and ablutions",
      "High-touch disinfection",
      "Colour-coded cleaning equipment",
    ],
  },
  {
    slug: "hospitality-cleaning",
    group: "sector",
    name: "Guest house & hospitality cleaning",
    summary:
      "Room turnovers, linen changes and public-area cleaning for guest houses, lodges and B&Bs.",
    includes: [
      "Room turnover between guests",
      "Bathrooms and kitchens",
      "Public areas and dining rooms",
      "Peak-season support",
    ],
  },
  {
    slug: "ablution-and-washroom-hygiene",
    group: "sector",
    name: "Ablution & washroom hygiene",
    summary:
      "Scheduled deep cleaning and descaling of toilets and washrooms, with consumables restocked.",
    includes: [
      "Toilets, urinals and basins descaled",
      "Floors, walls and partitions",
      "Soap, paper and sanitiser restocked",
      "Odour control",
    ],
  },

  // --- Residential ---
  {
    slug: "home-cleaning",
    group: "residential",
    name: "Home cleaning",
    summary:
      "Regular or once-off cleaning of houses and flats — the whole home or just the rooms that need it.",
    includes: [
      "Kitchens and bathrooms",
      "Bedrooms and living areas",
      "Floors, dusting and surfaces",
      "Weekly, fortnightly or once-off",
    ],
  },
  {
    slug: "complex-and-common-area-cleaning",
    group: "residential",
    name: "Complex & common-area cleaning",
    summary:
      "Stairwells, corridors, entrances and shared facilities in residential complexes and estates.",
    includes: [
      "Stairwells, corridors and lobbies",
      "Bin areas",
      "Shared ablutions and facilities",
      "Scheduled visits",
    ],
  },

  // --- Exterior & surfaces ---
  {
    slug: "floor-care",
    group: "exterior",
    name: "Floor stripping, sealing & polishing",
    summary:
      "Old sealer and polish stripped, the floor deep-scrubbed, then resealed and buffed to a protective shine.",
    includes: [
      "Vinyl, tiled and concrete floors",
      "Strip, seal and polish",
      "Machine buffing",
    ],
  },
  {
    slug: "window-cleaning",
    group: "exterior",
    name: "Window cleaning",
    summary:
      "Inside and outside glass, frames and sills on homes, offices and shopfronts.",
    includes: [
      "Glass, frames and sills",
      "Shopfronts and glass doors",
      "Once-off or scheduled",
    ],
  },
  {
    slug: "pressure-washing",
    group: "exterior",
    name: "Pressure washing",
    summary:
      "High-pressure cleaning of paving, driveways, walls, walkways and bin areas.",
    includes: [
      "Paving and driveways",
      "Exterior walls and walkways",
      "Bin areas and loading zones",
      "Oil stain treatment",
    ],
  },
  {
    slug: "vehicle-and-fleet-cleaning",
    group: "exterior",
    name: "Vehicle & fleet cleaning",
    summary:
      "Washing and valeting of company vehicles, buses and fleets on site, using our own vehicle-care range.",
    includes: [
      "Exterior wash and wheels",
      "Interior vacuum and wipe-down",
      "Engine bay degreasing on request",
      "At your depot",
    ],
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
