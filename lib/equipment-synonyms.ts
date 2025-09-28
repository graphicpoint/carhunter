// Equipment synonyms for flexible matching in car searches
// Maps equipment terms to their various synonyms used across Danish car sites

export interface EquipmentSynonym {
  term: string;
  synonyms: string[];
  searchPattern: string; // OR pattern for search
}

export const EQUIPMENT_SYNONYMS: EquipmentSynonym[] = [
  {
    term: "læder",
    synonyms: ["læder", "leather", "læderindtræk", "læder interiør", "læder sæder", "skindinteriør"],
    searchPattern: "(læder OR leather OR læderindtræk OR 'læder interiør' OR 'læder sæder' OR skindinteriør)"
  },
  {
    term: "sportssæder",
    synonyms: ["sportssæder", "sportsæder", "sport seats", "sport sæder", "S-line sæder", "sportsstole"],
    searchPattern: "(sportssæder OR sportsæder OR 'sport seats' OR 'sport sæder' OR 'S-line sæder' OR sportsstole)"
  },
  {
    term: "panoramatag",
    synonyms: ["panoramatag", "panorama tag", "soltag", "glasstag", "panoramic roof", "sunroof"],
    searchPattern: "(panoramatag OR 'panorama tag' OR soltag OR glasstag OR 'panoramic roof' OR sunroof)"
  },
  {
    term: "navigation",
    synonyms: ["navigation", "navi", "GPS", "navigationssystem", "infotainment", "MMI", "iDrive"],
    searchPattern: "(navigation OR navi OR GPS OR navigationssystem OR infotainment OR MMI OR iDrive)"
  },
  {
    term: "klimaanlæg",
    synonyms: ["klimaanlæg", "aircon", "aircondition", "klima", "automatisk klima", "2-zone klima"],
    searchPattern: "(klimaanlæg OR aircon OR aircondition OR klima OR 'automatisk klima' OR '2-zone klima')"
  },
  {
    term: "xenon",
    synonyms: ["xenon", "xenon lys", "HID", "bi-xenon", "LED forlygter", "adaptive lys"],
    searchPattern: "(xenon OR 'xenon lys' OR HID OR bi-xenon OR 'LED forlygter' OR 'adaptive lys')"
  },
  {
    term: "fartpilot",
    synonyms: ["fartpilot", "cruise control", "adaptive cruise", "ACC", "speed pilot"],
    searchPattern: "(fartpilot OR 'cruise control' OR 'adaptive cruise' OR ACC OR 'speed pilot')"
  },
  {
    term: "parkeringssensor",
    synonyms: ["parkeringssensor", "PDC", "parking sensor", "parkeringshjælp", "bagparkeringssensor"],
    searchPattern: "(parkeringssensor OR PDC OR 'parking sensor' OR parkeringshjælp OR bagparkeringssensor)"
  },
  {
    term: "bakspejl",
    synonyms: ["bakspejl", "bakkamera", "rear camera", "parkeringskamera", "360 kamera"],
    searchPattern: "(bakspejl OR bakkamera OR 'rear camera' OR parkeringskamera OR '360 kamera')"
  },
  {
    term: "bluetooth",
    synonyms: ["bluetooth", "hands-free", "telefon", "streaming", "wireless"],
    searchPattern: "(bluetooth OR hands-free OR telefon OR streaming OR wireless)"
  },
  {
    term: "metallic",
    synonyms: ["metallic", "metallic lak", "perlelak", "special lak", "metallic maling"],
    searchPattern: "(metallic OR 'metallic lak' OR perlelak OR 'special lak' OR 'metallic maling')"
  },
  {
    term: "fælge",
    synonyms: ["fælge", "alufælge", "alloy wheels", "sportsfælge", "lette fælge"],
    searchPattern: "(fælge OR alufælge OR 'alloy wheels' OR sportsfælge OR 'lette fælge')"
  }
];

/**
 * Convert equipment terms to search-friendly patterns with synonyms
 */
export function expandEquipmentTerms(equipment: string[]): string {
  if (!equipment || equipment.length === 0) return "";
  
  const expandedTerms = equipment.map(term => {
    const synonym = EQUIPMENT_SYNONYMS.find(s => 
      s.term.toLowerCase() === term.toLowerCase() ||
      s.synonyms.some(syn => syn.toLowerCase() === term.toLowerCase())
    );
    
    return synonym ? synonym.searchPattern : `"${term}"`;
  });
  
  return expandedTerms.join(" AND ");
}

/**
 * Get all possible synonyms for a given equipment term
 */
export function getEquipmentSynonyms(term: string): string[] {
  const synonym = EQUIPMENT_SYNONYMS.find(s => 
    s.term.toLowerCase() === term.toLowerCase() ||
    s.synonyms.some(syn => syn.toLowerCase() === term.toLowerCase())
  );
  
  return synonym ? synonym.synonyms : [term];
}
