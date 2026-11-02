// The city's fixed cast of hireable personnel. Each character appears at most once per game (in a market or on a
// roster) and is gone for good once killed. A unit type with no entries here still uses randomly generated recruits;
// a type whose characters are all taken is not offered until one frees up (dismissed, or their faction falls).
// Portrait: assets/units/<type>/<id>.webp (transparent, 1200x1500). Optional fx/fy override the detected face position.
(function (ND) {
  const M = (id, name, quote, bio) => ({ id: 'merc-' + id, type: 'merc', name, quote, bio });
  ND.ROSTER = [
    // Getaway drivers and smugglers
    M('driver-01', 'Dante "Keys" Moreau', 'Every lock in this city has a price. Mine is cheaper.', 'Stole his first car at twelve and has never paid for a ride since. Knows every service tunnel between the docks and the Spire.'),
    M('driver-02', 'Lupe "Redline" Ortega', 'You want it there fast or you want it there quiet?', 'Ran contraband for three gangs at once until two of them found out. The third one hired her.'),
    M('driver-03', 'Rafa "Static" Benítez', 'Channel nine. Always channel nine.', 'An old pirate radio jockey who now runs dispatch for anyone who pays. His walkie has never once been off.'),
    M('driver-04', 'Kenji "Varsity" Arai', 'Coach said I had fast hands. He meant the ball.', 'Lost a sports scholarship when the academy was bought out. Now he runs packages across rival blocks at a sprint.'),
    M('driver-05', 'Boone "Thermos" Kaleo', 'Relax. Coffee first, crime second.', 'A slow-talking smuggler who has hauled the same patched backpack through four border checkpoints and one war.'),
    M('driver-06', 'Mira "Waypoint" Solís', 'Left at the noodle stand. Trust me.', 'A route planner with a tablet full of police patrol timings. She has never been late and never been caught.'),
    M('driver-07', 'Ash "Parcel" Nakata', 'Don\'t ask what\'s in the box.', 'Nobody has seen the courier\'s face, and nobody has ever lost a delivery to them. Payment up front, in cash.'),
    // Underground fighters
    M('boxer-01', 'Jax "Iron Lung" Rivera', 'Hit me again. I dare you.', 'Undefeated in the pits of Blackwater Canal for two seasons straight. He fights for rent money and for the crowd.'),
    M('boxer-02', 'Yara "Southpaw" Haddad', 'They always watch the right hand.', 'A former champion banned from the legal circuit for breaking a referee\'s jaw. She still says he deserved it.'),
    M('boxer-03', 'Tomas "The Wall" Fale', 'Twenty years. Nobody\'s put me down yet.', 'The oldest fighter still working the cages. Younger brawlers pay him just to spar and learn how to take a hit.'),
    M('boxer-04', 'Ren "Dragon" Kurosawa', 'Ink doesn\'t bleed. I do. Rarely.', 'A bare-knuckle legend whose dragon tattoo has its own fan club. Fights shirtless, smiling, and usually alone.'),
    M('boxer-05', 'Vee "Pink Slip" Navarro', 'You\'re fired. From consciousness.', 'Quit her factory job by knocking out her supervisor. Discovered she liked it, and turned pro the same night.'),
    M('boxer-06', 'Gus "Towel" Brennan', 'I know when to throw it in. Do you?', 'A worn-out cornerman who stepped into the ring when his fighter didn\'t show. Won. Never left.'),
    M('boxer-07', 'Kai "Headband" Mahoe', 'One more round. Always one more round.', 'A stubborn kid from the residential blocks who trains on rooftops at dawn. He still owes the gym six months of fees.'),
    // Hired bodyguards
    M('guard-01', 'Victor "Suit" Lang', 'I\'m paid to stand here. I\'m very good at standing here.', 'Former corporate security who walked away with a severance package and a rifle nobody asked him to return.'),
    M('guard-02', 'Elena "Shade" Vasquez', 'I see you. I always see you.', 'Guarded a senator for six years and buried his secrets with him. She has excellent references and no conscience.'),
    M('guard-03', 'Marcus "Bulwark" Okoye', 'Get behind me.', 'Took three rounds for a client in the Gilded Exchange shootout and walked out carrying him. His rates doubled afterwards.'),
    M('guard-04', 'Nils "Frost" Ekström', 'Calm is a weapon. Learn to aim it.', 'A quiet northern contractor who never raises his voice or his heart rate. Clients find it unsettling. Enemies more so.'),
    M('guard-05', 'Scarlett "Wire" Quinn', 'Earpiece in. Small talk out.', 'Coordinates protection details with a calm voice and a short temper. Has a list of former clients she will never work for again.'),
    M('guard-06', 'Walter "Old Guard" Pryce', 'I\'ve outlived three bosses. I intend to outlive you too.', 'Silver-bearded veteran of the old syndicate wars. Carries a sidearm older than most of the crew he leads.'),
    M('guard-07', 'June "Overwatch" Park', 'Rooftops are mine. Streets are yours.', 'A former police tactical officer who quit after a raid went wrong. Prefers high ground and long silences.'),
    M('guard-08', 'Rico "Breacher" Santos', 'Doors are a suggestion.', 'Ex-military entry specialist with a shotgun and very little patience. He has never knocked in his life.'),
    // Street-gang recruits
    M('thug-01', 'Tyler "Tracksuit" Osei', 'Fresh kicks, fresh start.', 'Grew up running errands for corner dealers. Now he wants a crew of his own and a name everyone knows.'),
    M('thug-02', 'Roxy "Cherry" Kade', 'Cute, right? Now run.', 'Leader of a girl gang from Neon Row who spray their tag on every wall they take. Dangerous when bored.'),
    M('thug-03', 'Milo "Smoke" Dragan', 'Turn it up. I can\'t hear the sirens.', 'A sound-system kid who runs illegal block parties and collects debts between songs.'),
    M('thug-04', 'Nadia "Goggles" Ferreira', 'I fix things. Sometimes I break them first.', 'A scrapyard scavenger with a talent for rewiring stolen bikes. Joins whoever pays in parts.'),
    M('thug-05', 'Benny "Gold Tooth" Akande', 'Smile for the cameras, baby.', 'A loudmouth hustler with more chains than sense. Somehow he always knows someone who knows someone.'),
    M('thug-06', 'Big Sal "Bricks" Romano', 'I don\'t run. I don\'t need to.', 'A heavyset enforcer who guards the same street corner every night. Nobody remembers seeing him sit down.'),
    M('thug-07', 'Luna "Hex" Morrow', 'Bad luck follows me. Hope it likes you.', 'A goth runaway who joined a street crew to disappear. Fights dirty, laughs at funerals.'),
    M('thug-08', 'Danny "Slugger" Ruiz', 'Batter up.', 'Washed out of the minor leagues and kept the bat. Uses it now for a different kind of home run.'),
    M('thug-09', 'Skye "Ghost" Larsen', 'You never saw me. That\'s the point.', 'A white-haired pickpocket who can lift a wallet mid-handshake. Wanted in three districts, convicted in none.'),
    M('thug-10', 'Paco "Shades" Villanueva', 'Cool heads make money. Hot heads make headlines.', 'A smooth-talking gunrunner who sells pistols out of his jacket and never haggles.'),
    // Veterans and soldiers of fortune
    M('veteran-01', 'Cole "Bandana" Harker', 'I\'ve been shot at by better people than you.', 'Fought in the Water Riots on the losing side and has been looking for a winning one ever since.'),
    M('veteran-02', 'Sid "Lighter" Moreno', 'Got a light? Never mind. Got a target?', 'A demolitions specialist who smokes too much for someone who works with explosives. Has a nervous habit of counting exits.'),
    M('veteran-03', 'Gideon "Monocle" Ward', 'Patience, child. The shot comes to you.', 'The oldest rifleman for hire in the city. His scope eye was replaced years ago, and it is still sharper than yours.'),
    M('veteran-04', 'Hector "Beret" Calderón', 'Discipline is cheaper than bullets.', 'A former colonel of a disbanded militia who still runs his crew like an army. Insists on being saluted.'),
    M('veteran-05', 'Kira "Two-Gun" Lindqvist', 'One for you. One for your friend.', 'A quick-draw specialist who learned to shoot from her grandmother. Never misses twice.'),
    M('veteran-06', 'Nomad "No Name" Sato', '...', 'Says nothing, takes the money, finishes the job. Rumoured to have deserted from three different armies.'),
    M('veteran-07', 'Earl "Big Iron" Dawson', 'Mind the barrel, son.', 'A hard-drinking machine gunner with a soft spot for stray dogs and a hard spot for everyone else.'),
    M('veteran-08', 'Spike "Rust" Malloy', 'Knife\'s quieter. Knife\'s cheaper.', 'A punk who survived the industrial fires and came out mean. Collects patches from every crew he has outlasted.'),
    M('veteran-09', 'Hana "Packmule" Ivanova', 'Everything you need is in this bag. Probably.', 'A refugee medic turned quartermaster who walked out of the burning Industrial Zone carrying forty kilos of supplies.'),
    M('veteran-10', 'Ivan "Patch" Kowalski', 'One eye is plenty to aim with.', 'An old detective who lost his eye, his badge and his pension in the same week. Now he solves problems for cash.'),
  ];
})(window.ND);
