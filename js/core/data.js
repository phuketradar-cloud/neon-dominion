// Static game definitions: resources, rules, district types, factions, names.
(function (ND) {
  ND.RES = ['credits', 'energy', 'materials', 'intel'];
  ND.RES_LABEL = { credits: 'Credits', energy: 'Energy', materials: 'Materials', intel: 'Intel Data' };
  ND.RES_SHORT = { credits: 'CR', energy: 'EN', materials: 'MT', intel: 'ID' };

  ND.RULES = {
    gridW: 10,
    gridH: 10,
    startRes: { credits: 300, energy: 60, materials: 60, intel: 20 },
    hqYield: { credits: 30, energy: 6, materials: 6, intel: 2 },
    upkeep: { credits: 3, energy: 1 },   // per controlled district (HQ exempt)
    captureMin: 50,                      // influence needed to seize a district
    captureMargin: 15,                   // ...and lead over the runner-up
    holdMin: 25,                         // owner loses control below this
    skimMin: 30,                         // partial influence that skims income
    skimRate: 0.2,
    driftOwned: 3,                       // owner influence regrowth per turn (from neutral share)
    driftHQ: 6,
    lostContactFade: 2,                  // influence fade in unreachable, uncontrolled districts
    securityDrift: 2,                    // security returns toward its base each turn
    baseOps: 3,
    opsPerDistricts: 4,
    maxOps: 10,
    victoryShare: 0.5,
    devMult: [1, 1.5, 2],
    unrestLoss: 5,
  };

  ND.TYPES = {
    residential: { label: 'Residential Zone', yields: { credits: 8 }, pop: [60, 160], sec: [10, 30], weight: 22,
      fac: ['Hab Stack', 'Street Market', 'Noodle Row', 'Data Café', 'Ration Depot'] },
    industrial: { label: 'Industrial Factory', yields: { credits: 3, materials: 7 }, pop: [15, 50], sec: [15, 35], weight: 14,
      fac: ['Smelter', 'Assembly Line', 'Scrapyard', 'Chem Vats'] },
    research: { label: 'Research Facility', yields: { credits: 2, intel: 5 }, pop: [8, 25], sec: [35, 55], weight: 8,
      fac: ['Neural Lab', 'Server Farm', 'Gene Bank', 'Prototype Bay'] },
    blackmarket: { label: 'Black Market', yields: { credits: 11, intel: 1 }, pop: [20, 60], sec: [5, 15], weight: 9,
      fac: ['Chop Shop', 'Arms Bazaar', 'Fence Den', 'Stim Clinic'] },
    casino: { label: 'Casino Strip', yields: { credits: 14 }, pop: [20, 50], sec: [25, 45], weight: 7,
      fac: ['Neon Casino', 'Fight Pit', 'Lounge Strip', 'Holo Arcade'] },
    hospital: { label: 'Hospital', yields: { credits: 5, materials: 1, intel: 1 }, pop: [15, 40], sec: [20, 40], weight: 6,
      fac: ['Trauma Ward', 'Cyber Clinic', 'Morgue', 'Pharma Store'] },
    police: { label: 'Police Station', yields: { credits: 3, intel: 3 }, pop: [10, 30], sec: [55, 75], weight: 7,
      fac: ['Precinct HQ', 'Detention Block', 'Drone Hangar', 'Evidence Vault'] },
    power: { label: 'Power Plant', yields: { energy: 9, credits: 1 }, pop: [5, 20], sec: [30, 50], weight: 9,
      fac: ['Fusion Core', 'Coal Stacks', 'Grid Relay', 'Coolant Towers'] },
    military: { label: 'Military Installation', yields: { materials: 4, energy: 2 }, pop: [5, 15], sec: [60, 80], weight: 6,
      fac: ['Armory', 'Barracks', 'Motor Pool', 'Missile Silo'] },
    corporate: { label: 'Corporate HQ', yields: { credits: 15, intel: 2 }, pop: [20, 60], sec: [45, 70], weight: 6,
      fac: ['Executive Spire', 'Trading Floor', 'Data Vault', 'Sky Lobby'] },
  };

  // mods are the mechanical bonuses/weaknesses; every text claim below is backed by a mod used in the rules.
  ND.FACTIONS = [
    {
      id: 'syndicate', name: 'The Syndicate', short: 'SYN', color: '#e3b23c', leader: 'Don Vasko Reyes', hqName: 'Gilded Exchange',
      motto: 'Every vote has a price.',
      identity: 'A cartel of bankers, fixers and loan sharks laundering the city\'s blood money through a web of shell corporations.',
      ability: 'Laundered Capital — +10% credits from controlled districts; bribes cost 25% less.',
      economy: '+10% credits from every controlled district.',
      weakness: 'Soft Touch — influence campaigns gain 3 less influence.',
      military: 'Private Security — +2 DEF for units defending their own districts.',
      tech: 'Shell Corporations',
      aiStrategy: 'Builds wealth first: develops high-value districts and buys its way into casinos and corporate towers.',
      mods: { yield: { credits: 1.1 }, campaignGain: -3, bribeCost: 0.75, combat: { defendDef: 2 } },
      ai: { expand: 1.1, consolidate: 0.9, develop: 1.7, fortify: 0.6, bribe: 1.2, aggression: 0.6, prefer: ['casino', 'corporate', 'blackmarket'] },
      portrait: { skin: '#c79b78', hair: '#1a1410', accent: 'shades' },
    },
    {
      id: 'legion', name: 'Iron Legion', short: 'LEG', color: '#e0384a', leader: 'Marshal Kade Voronin', hqName: 'Bastion Prime',
      motto: 'Steel outlasts flesh.',
      identity: 'A deserted army battalion turned warlord state, ruling its blocks with armor, checkpoints and curfews.',
      ability: 'Fortress Doctrine — fortifications cost 30% less and add +25 security instead of +15.',
      economy: '+20% materials from controlled districts.',
      weakness: 'War Chest Drain — 5% fewer credits from controlled districts.',
      military: 'Heavy Weapons — +2 ATK and +1 DEF in every battle.',
      tech: 'Siege Exoframes',
      aiStrategy: 'Grinds forward behind fortified lines, favours military, industrial and power districts, and attacks rivals readily.',
      mods: { yield: { credits: 0.95, materials: 1.2 }, fortifyCost: 0.7, fortifyAmt: 25, combat: { atk: 2, def: 1 } },
      ai: { expand: 1.3, consolidate: 1.0, develop: 1.4, fortify: 1.0, bribe: 0.5, aggression: 1.3, prefer: ['military', 'industrial', 'power'] },
      portrait: { skin: '#a77d62', hair: '#555d66', accent: 'helmet' },
    },
    {
      id: 'cult', name: 'Cyber Cult', short: 'CUL', color: '#2fd6e6', leader: 'The Oracle Nyx-7', hqName: 'Mainframe Cathedral',
      motto: 'The network sees. The network provides.',
      identity: 'Techno-mystics who worship an emergent AI and wire the city\'s cameras, phones and implants into one all-seeing eye.',
      ability: 'Panopticon — sees every rival treasury and operation on the map; algorithmic propaganda gives campaigns +2 influence.',
      economy: '+60% intel data from controlled districts.',
      weakness: 'Fragile Supply — 25% fewer materials from controlled districts.',
      military: 'Combat Drones — +12% hit chance in every battle.',
      tech: 'Ghost Protocol AI',
      aiStrategy: 'Targets research, police and power districts; bribes officials heavily to soften security.',
      mods: { yield: { intel: 1.6, materials: 0.75 }, panopticon: true, campaignGain: 2, combat: { hit: 12 } },
      ai: { expand: 1.3, consolidate: 1.0, develop: 1.4, fortify: 0.8, bribe: 1.5, aggression: 0.8, prefer: ['research', 'police', 'power'] },
      portrait: { skin: '#d6c2b0', hair: '#0c1e24', accent: 'visor' },
    },
    {
      id: 'mutants', name: 'Bio Mutants', short: 'MUT', color: '#7ddc2c', leader: 'Mother Gristle', hqName: 'The Brood Vats',
      motto: 'Flesh is a draft. We are the revision.',
      identity: 'A brood of gene-hacked outcasts grown in illegal vats, spreading through hospitals and labs like an infection.',
      ability: 'Regeneration — +2 extra influence regrowth per turn in every controlled district.',
      economy: '+15% energy from controlled districts (bio-reactors).',
      weakness: 'Toxic Upkeep — every controlled district costs 1 extra energy per turn.',
      military: 'Unkillable Flesh — +4 HP in battle; fallen units die half as often.',
      tech: 'Hive Genome',
      aiStrategy: 'Spreads steadily, consolidates every district it touches, and prizes hospitals and research labs.',
      mods: { yield: { energy: 1.15 }, drift: 2, upkeepEnergy: 1, combat: { hp: 4, deathMult: 0.5 } },
      ai: { expand: 1.3, consolidate: 1.3, develop: 1.4, fortify: 0.9, bribe: 0.7, aggression: 0.9, prefer: ['hospital', 'research', 'industrial'] },
      portrait: { skin: '#8fae6a', hair: '#2b3a1a', accent: 'growth' },
    },
    {
      id: 'shadow', name: 'Shadow Network', short: 'SHD', color: '#a061ff', leader: 'Whisper', hqName: 'Silent Spire',
      motto: 'You never saw us.',
      identity: 'Spies, assassins and data brokers who own the city\'s secrets and sell them to the highest bidder.',
      ability: 'Deep Cover — bribes cut security by 20 instead of 12; campaigns in rival-held districts gain +6.',
      economy: '+30% intel data from controlled districts.',
      weakness: 'Thin Ledger — 5% fewer credits from controlled districts.',
      military: 'Ambush — +4 ATK in the first round of battles it starts.',
      tech: 'Phantom Cloaking',
      aiStrategy: 'Bribes its way past security and preys on rival-held districts rather than empty ones.',
      mods: { yield: { credits: 0.95, intel: 1.3 }, bribeAmt: 20, rivalCampaign: 6, combat: { ambush: 4 } },
      ai: { expand: 1.3, consolidate: 0.9, develop: 1.4, fortify: 0.7, bribe: 1.6, aggression: 1.5, prefer: ['police', 'corporate', 'research'] },
      portrait: { skin: '#b8a090', hair: '#120c1c', accent: 'hood' },
    },
    {
      id: 'reapers', name: 'Street Reapers', short: 'REA', color: '#ff7b1c', leader: 'Saint Rook', hqName: 'Reaper Yard',
      motto: 'The street belongs to whoever shows up.',
      identity: 'The biggest gang in the city — thousands of kids with chrome and nothing to lose, swallowing block after block.',
      ability: 'Mob Rule — influence campaigns gain +2 and cost 10% less.',
      economy: '+20% credits from residential zones.',
      weakness: 'Fickle Loyalty — 1 less influence regrowth in controlled districts; development costs 30% more.',
      military: 'Swarm — +1 ATK per unit it outnumbers the enemy by (max +2).',
      tech: 'Swarm Tactics',
      aiStrategy: 'Expands as fast as possible into residential and black-market districts, spending little on development.',
      mods: { campaignGain: 2, campaignCost: 0.9, typeYield: { residential: 1.2 }, drift: -1, developCost: 1.3, combat: { swarm: 2 } },
      ai: { expand: 1.1, consolidate: 0.9, develop: 0.9, fortify: 0.6, bribe: 0.8, aggression: 1.0, prefer: ['residential', 'blackmarket'] },
      portrait: { skin: '#9a6b4f', hair: '#ff7b1c', accent: 'mohawk' },
    },
  ];
  ND.FDEF = Object.fromEntries(ND.FACTIONS.map((f) => [f.id, f]));

  ND.NAME_A = ['Rust', 'Chrome', 'Ash', 'Neon', 'Iron', 'Velvet', 'Static', 'Cinder', 'Glass', 'Hollow', 'Kowloon', 'Sable',
    'Toxic', 'Ozone', 'Cobalt', 'Ember', 'Gutter', 'Silicon', 'Obsidian', 'Mercury', 'Grim', 'Vapor', 'Scarlet', 'Pale',
    'Copper', 'Dread', 'Echo', 'Null', 'Sodium', 'Ghost', 'Blackwater', 'Tin'];
  ND.NAME_B = ['Row', 'Heights', 'Sprawl', 'Docks', 'Yards', 'Spire', 'Flats', 'Junction', 'Quarter', 'Pits', 'Gardens',
    'Strip', 'Hollow', 'Foundry', 'Market', 'Terrace', 'Arcology', 'Gate', 'Warrens', 'Canal'];
})(window.ND);
