export const SITE_GROUPS = {
  DK: [
    'bilbasen.dk',
    'dba.dk', 
    'biltorvet.dk',
    'autotorvet.dk',
    'autobasen.dk',
    'bilhandel.dk',
    'bilsalg.autocom.dk'
  ],
  EU: [
    'mobile.de',
    'autoscout24.com',
    'heycar.de'
  ]
} as const;

export const ALL_SITES = [
  ...SITE_GROUPS.DK,
  ...SITE_GROUPS.EU
] as const;

export const SITE_OPTIONS = [
  // Group options
  { value: 'group:DK', label: 'Danske sites (alle)', isGroup: true },
  { value: 'group:EU', label: 'Europæiske sites (alle)', isGroup: true },
  
  // Individual Danish sites
  { value: 'bilbasen.dk', label: 'Bilbasen.dk', group: 'DK' },
  { value: 'dba.dk', label: 'DBA.dk', group: 'DK' },
  { value: 'biltorvet.dk', label: 'Biltorvet.dk', group: 'DK' },
  { value: 'autotorvet.dk', label: 'Autotorvet.dk', group: 'DK' },
  { value: 'autobasen.dk', label: 'Autobasen.dk', group: 'DK' },
  { value: 'bilhandel.dk', label: 'Bilhandel.dk', group: 'DK' },
  { value: 'bilsalg.autocom.dk', label: 'Bilsalg.autocom.dk', group: 'DK' },
  
  // Individual European sites
  { value: 'mobile.de', label: 'Mobile.de', group: 'EU' },
  { value: 'autoscout24.com', label: 'AutoScout24.com', group: 'EU' },
  { value: 'heycar.de', label: 'HeyCar.de', group: 'EU' },
] as const;

export type SiteValue = typeof ALL_SITES[number] | `group:${keyof typeof SITE_GROUPS}`;

export function expandSiteSelection(selectedSites: SiteValue[]): string[] {
  const expanded = new Set<string>();
  
  for (const site of selectedSites) {
    if (site.startsWith('group:')) {
      const groupName = site.replace('group:', '') as keyof typeof SITE_GROUPS;
      if (SITE_GROUPS[groupName]) {
        SITE_GROUPS[groupName].forEach(s => expanded.add(s));
      }
    } else {
      expanded.add(site);
    }
  }
  
  return Array.from(expanded);
}
