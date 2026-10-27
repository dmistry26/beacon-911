// Deterministic rules-based triage over English text. Always runs (instant, offline);
// the LLM analysis is merged on top of it when a Groq key is configured.

export const TAG_LABELS = {
  trapped: 'Person trapped',
  explosion: 'Explosion / fuel hazard',
  mobility: 'Cannot self-evacuate',
  child: 'Child / infant involved',
  elderly: 'Elderly person involved',
  injured: 'Injury reported',
  unconscious: 'Unresponsive person',
  hazmat: 'Gas / hazmat odor',
  weapon: 'Weapon reported',
  powerline: 'Downed power lines',
  pregnant: 'Pregnant / in labor',
  collapse: 'Structural collapse',
  smoke: 'Smoke inhalation',
};
export const CRITICAL_TAGS = ['trapped', 'unconscious', 'weapon', 'explosion', 'collapse', 'mobility'];
export const TAG_WEIGHT = { trapped: 25, unconscious: 20, weapon: 20, explosion: 15, collapse: 18, mobility: 12, child: 12, elderly: 8, injured: 8, pregnant: 10, hazmat: 8, powerline: 8, smoke: 6 };

const has = (t, re) => re.test(t);

export function heuristics(text) {
  const raw = text || '';
  const t = raw.toLowerCase();
  const tags = new Set();
  const details = {};

  if (has(t, /trapped|stuck (inside|in the|upstairs)|can'?t (get|come) (out|down)|cannot (get|come) (out|down)|can'?t escape|cannot escape|pinned/)) tags.add('trapped');
  const fuel = t.match(/propane|gas tank|oxygen (tank|bottle|canister)|ammunition|fireworks|gasoline|chemicals?|fuel tank|explosi\w+/);
  if (fuel) {
    tags.add('explosion');
    details.explosion = /propane/.test(fuel[0]) ? 'Propane tank on site' : /oxygen/.test(fuel[0]) ? 'Oxygen tank on site' : /gas tank|gasoline|fuel/.test(fuel[0]) ? 'Fuel tank on site' : /explosi/.test(fuel[0]) ? 'Possible explosion' : `Hazard: ${fuel[0]}`;
  }
  if (has(t, /wheelchair|can'?t walk|cannot walk|bedridden|can'?t move|cannot move|disabled|paralyzed|oxygen machine/)) tags.add('mobility');
  if (has(t, /\bchild\b|children|\bkids?\b|\bbaby\b|infant|toddler|newborn|\bson\b|daughter/)) tags.add('child');
  if (has(t, /grandmother|grandfather|grandma|grandpa|elderly|old man|old woman|senior|\babuela\b|\babuelo\b/)) tags.add('elderly');
  if (has(t, /hurt|injur|bleed|blood|burned|burnt|broken (arm|leg|bone)|wound|stab|shot\b|gunshot/)) tags.add('injured');
  if (has(t, /unconscious|unresponsive|passed out|collapsed|not responding|won'?t wake|not breathing|isn'?t breathing|no pulse/)) tags.add('unconscious');
  if (has(t, /smell (of )?gas|gas leak|gas smell/)) { tags.add('hazmat'); details.hazmat = 'Gas odor reported'; }
  if (has(t, /weapon|\bgun\b|knife|armed|firearm|shooting|rifle/)) tags.add('weapon');
  if (has(t, /power ?lines?|live wire|downed wire|sparking wire/)) tags.add('powerline');
  if (has(t, /pregnan|in labor|labour|contractions|water broke|giving birth|having a baby|baby is coming/)) tags.add('pregnant');
  if (has(t, /collaps\w+|rubble|fell down|caved in|building fell/) && !has(t, /collapsed and|he collapsed|she collapsed|passed out/)) tags.add('collapse');
  if (has(t, /smoke inhalation|coughing .*smoke|from the smoke|breathing in smoke/)) tags.add('smoke');

  const floorM = t.match(/(1st|first|2nd|second|3rd|third|4th|fourth|top) (floor|story|level)|upstairs|attic|basement|roof/);
  const floor = floorM ? floorM[0].replace(/^second/, '2nd').replace(/^first/, '1st').replace(/^third/, '3rd') : null;
  if (tags.has('trapped') && floor) details.trapped = `Person trapped · ${floor}`;

  let category = 'other';
  let type = 'Unclassified request';
  let severity = 4;
  let protocolId = null;
  let conf = 0.55;

  if (has(t, /not breathing|isn'?t breathing|no pulse|cardiac|heart attack|unresponsive|collapsed and|he collapsed|she collapsed|not responding|stopped breathing|needs cpr/)) {
    category = 'medical'; type = 'Cardiac arrest / unresponsive'; severity = 1; protocolId = 'cpr'; conf = 0.9;
  } else if (has(t, /chok/)) {
    category = 'medical'; type = 'Choking'; severity = 1; protocolId = 'choking'; conf = 0.92;
  } else if (has(t, /in labor|labour|giving birth|having a baby|baby is coming|contractions|water broke/)) {
    category = 'medical'; type = 'Childbirth'; severity = 2; protocolId = 'childbirth'; conf = 0.9;
  } else if (has(t, /stroke|face (is )?droop|slurred|can'?t speak properly/)) {
    category = 'medical'; type = 'Possible stroke'; severity = 1; protocolId = 'stroke'; conf = 0.85;
  } else if (has(t, /overdos|too many pills|fentanyl|narcan|poison/)) {
    category = 'medical'; type = 'Overdose / poisoning'; severity = 1; protocolId = 'overdose'; conf = 0.85;
  } else if (has(t, /seizure|convuls/)) {
    category = 'medical'; type = 'Seizure'; severity = 2; protocolId = 'seizure'; conf = 0.88;
  } else if (has(t, /earthquake|building (collapsed|fell)|a building collapsed|rubble|aftershock|caved in/)) {
    category = 'quake'; type = tags.has('trapped') ? 'Structural collapse · trapped' : 'Earthquake damage'; severity = tags.has('trapped') ? 1 : 2; protocolId = 'earthquake'; conf = 0.8;
  } else if (has(t, /can'?t breathe|cannot breathe|trouble breathing|hard to breathe|short of breath|difficulty breathing|struggling to breathe|catch (her|his|their|my) breath|wheez|asthma|allergic reaction|throat (is )?(closing|swelling)/) && !has(t, /house|building|roof|flames/)) {
    category = 'medical'; type = tags.has('smoke') ? 'Smoke inhalation' : /allergic|throat/.test(t) ? 'Allergic reaction · breathing' : 'Breathing difficulty'; severity = 1; protocolId = 'breathing'; conf = 0.85;
  } else if (has(t, /fire|flames|burning|smoke|blaze/)) {
    category = 'fire'; conf = 0.85;
    if (has(t, /brush|wildfire|forest|grass|hill|vegetation|field|ridge|orchard|crop|trees?\b/) && !has(t, /house|apartment|building|roof/)) {
      type = 'Wildland / brush fire'; severity = 3; protocolId = 'wildfire_evac';
    } else if (has(t, /car|truck|vehicle|motorcycle/) && !has(t, /house|building|apartment/)) {
      type = 'Vehicle fire'; severity = 2; protocolId = 'vehicle_crash';
    } else if (has(t, /house|home|apartment|building|roof|kitchen|garage|attic|store|room|flames/)) {
      type = 'Structure fire'; severity = 2; protocolId = 'structure_fire';
    } else {
      type = 'Fire / smoke report'; severity = 3; protocolId = 'wildfire_evac'; conf = 0.7;
    }
  } else if (has(t, /crash|collision|accident|rolled over|rollover|car hit|hit by a (car|vehicle)|hit and run/)) {
    category = 'crash'; type = 'Vehicle crash'; severity = 2; protocolId = 'vehicle_crash'; conf = 0.88;
  } else if (has(t, /smell (of )?gas|gas leak|gas smell/)) {
    category = 'gas'; type = 'Gas leak'; severity = 2; protocolId = 'gas_leak'; conf = 0.88;
  } else if (has(t, /bleed|blood|stab|gunshot|shot\b/)) {
    category = 'medical'; type = 'Severe bleeding'; severity = 2; protocolId = 'bleeding'; conf = 0.82;
  } else if (has(t, /\bburn(ed|t|s)?\b|scald/)) {
    category = 'medical'; type = 'Burns'; severity = 2; protocolId = 'burns'; conf = 0.8;
  } else if (has(t, /flood|water (is )?rising|swept/)) {
    category = 'flood'; type = 'Flooding'; severity = 3; conf = 0.8;
  } else if (has(t, /robber|break-?in|breaking in|intruder|gun|weapon|knife|assault|fight|domestic|threat|attack|stolen|burglar/)) {
    category = 'police'; type = tags.has('weapon') ? 'Armed threat' : 'Police request'; severity = tags.has('weapon') ? 1 : 3; conf = 0.8;
  } else if (has(t, /sick|hurt|pain|fell|injur|dizzy|faint|medical|ambulance|chest/)) {
    category = 'medical'; type = has(t, /chest/) ? 'Chest pain' : 'Medical complaint'; severity = has(t, /chest/) ? 2 : 3; conf = 0.65;
  }

  // Tag-driven severity escalation
  if (tags.has('trapped') || tags.has('weapon')) severity = Math.min(severity, 1);
  if (tags.has('unconscious') && category !== 'other') severity = Math.min(severity, 1);
  if (tags.has('mobility') || tags.has('explosion') || tags.has('collapse')) severity = Math.min(severity, 2);
  if ((tags.has('child') || tags.has('elderly')) && category === 'fire') severity = Math.min(severity, 2);

  const addrM = raw.match(/\b(\d{2,5}\s+(?:[A-Z][\w'.-]*\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Hwy|Highway|Pkwy|Parkway))\b/);

  return {
    category, type, severity, protocolId, confidence: conf,
    tags: [...tags], details, floor,
    address: addrM ? addrM[1] : null,
  };
}

// Safety net: danger words in the caller's OWN language, so a failed or wrong translation
// can't hide them. Each match only ever ADDS a tag (more caution), never removes one.
const NATIVE = {
  es: [[/atrapad[oa]s?|no (puede|pueden|podemos) salir/, 'trapped'], [/no respira|inconsciente|desmay|no despierta/, 'unconscious'], [/sangr|herid|no puede respirar/, 'injured'], [/silla de ruedas|no (puede|pueden) caminar/, 'mobility'], [/pistola|arma|cuchillo/, 'weapon'], [/embarazada|va a dar a luz/, 'pregnant']],
  vi: [[/bị kẹt|mắc kẹt|không ra (ngoài )?được/, 'trapped'], [/không thở|bất tỉnh|ngất/, 'unconscious'], [/chảy máu|bị thương|khó thở/, 'injured'], [/xe lăn|không (đi|bước) được/, 'mobility'], [/súng|dao/, 'weapon'], [/mang thai|sắp sinh/, 'pregnant']],
  zh: [[/被困|困住|出不来/, 'trapped'], [/没有呼吸|没呼吸|不呼吸|昏迷|晕倒|叫不醒/, 'unconscious'], [/流血|受伤|喘不上气|呼吸困难/, 'injured'], [/轮椅|不能走|走不了/, 'mobility'], [/枪|刀/, 'weapon'], [/怀孕|要生了/, 'pregnant']],
  tl: [[/naipit|nakulong|hindi (makalabas|makaalis)/, 'trapped'], [/hindi humihinga|walang malay|nawalan ng malay/, 'unconscious'], [/dumudugo|sugatan|nasaktan|hindi makahinga/, 'injured'], [/wheelchair|hindi makalakad/, 'mobility'], [/baril|kutsilyo/, 'weapon'], [/buntis|manganganak/, 'pregnant']],
  hi: [[/फँस|फंस|निकल नहीं/, 'trapped'], [/बेहोश|साँस नहीं ले रह|सांस नहीं ले रह/, 'unconscious'], [/खून|घायल|साँस नहीं ले पा|सांस नहीं ले पा/, 'injured'], [/व्हीलचेयर|चल नहीं/, 'mobility'], [/बंदूक|चाकू/, 'weapon'], [/गर्भवती|प्रसव/, 'pregnant']],
};
NATIVE.mix = NATIVE.es;
export function nativeDanger(text, lang) {
  const t = (text || '').toLowerCase();
  return (NATIVE[lang] || []).filter(([re]) => re.test(t)).map(([, tag]) => tag);
}

// Classify the caller's answer to "Is anyone hurt or trapped?". Only a CLEAR "no" lets the AI close a call.
export function classifyAnswer(en) {
  const t = (en || '').toLowerCase().trim();
  if (/don'?t know|do not know|not sure|unsure|maybe|no idea|possibly|i guess|can'?t tell|might be|not certain|i think so/.test(t)) return 'unsure';
  if (/^\W*(no|nope|nobody|no one|none|negative)\b|everyone(?:'s| is| got| has)? ?(?:all )?(?:out|ok|okay|fine|safe)\b|\bwe(?:'re| are)? (?:all )?(?:ok|okay|fine|safe|out)\b|\ball (?:safe|out|okay|ok|fine)\b|i don'?t think so|not that i know/.test(t)) return 'no';
  return 'other';
}
