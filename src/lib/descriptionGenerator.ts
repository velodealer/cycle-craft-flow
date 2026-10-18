// Rules-based (no AI) listing description writer.
// Builds emotive copy only from facts stored on the bike and its fitted parts.
// Missing facts are skipped, never invented. Same bike + same seed => same text.

type Part = { slot?: string; brand?: string | null; model?: string | null; description?: string | null };

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lc = (s: unknown) => clean(s).toLowerCase();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Name a part without part numbers: "Shimano Ultegra", "DT Swiss ARC 1600". */
export function partLabel(p?: Part | null): string {
  if (!p) return '';
  const brand = clean(p.brand);
  let model = clean(p.model)
    .replace(/\b[A-Z]{1,3}-[A-Z]?\d{3,5}[A-Z]?\b/g, '') // RD-R8000, FC-R8000
    .replace(/\s+/g, ' ').trim();
  if (brand && model.toLowerCase().startsWith(brand.toLowerCase())) model = model.slice(brand.length).trim();
  return clean(`${brand} ${model}`);
}

type Family = 'road' | 'gravel' | 'cx' | 'mtb' | 'ebike' | 'city' | 'tt' | 'other';

function familyOf(bike: any): Family {
  const t = lc(bike?.bike_type);
  if (bike?.is_electric || t === 'electric') return 'ebike';
  if (t === 'gravel') return 'gravel';
  if (t === 'cyclocross') return 'cx';
  if (t.startsWith('mtb')) return 'mtb';
  if (['hybrid', 'city', 'folding', 'cargo', 'touring'].includes(t)) return 'city';
  if (t === 'tt') return 'tt';
  if (t === 'road' || t === 'track') return 'road';
  return 'other';
}

const CONDITION: Record<string, string> = {
  new: 'brand new', as_new: 'as-new', excellent: 'excellent', good: 'good', fair: 'fair',
};

const BANK: Record<Family, { kind: string; hooks: string[]; ride: string[]; close: string[]; pursuits: string }> = {
  road: {
    kind: 'road bike',
    hooks: ['Experience the thrill of pure speed with this stunning {name}.', 'Experience the exhilaration of speed and precision with this exceptional {name}.', 'Discover what effortless pace feels like with this beautiful {name}.'],
    ride: ['Every pedal stroke translates directly into forward motion, turning climbs into conquests and descents into pure flowing freedom.', 'It rewards every effort with sharp, responsive handling and the confidence to push harder.'],
    close: ['Your next personal best starts here.', 'Don’t just dream about the ride — own it.', 'Ready to elevate your cycling.'],
    pursuits: 'chasing personal bests or discovering new routes',
  },
  gravel: {
    kind: 'gravel bike',
    hooks: ['Experience the pure joy of adventure with this stunning {name}.', 'Built for the open road and wild trails alike, this {name} is your ticket beyond the tarmac.'],
    ride: ['It feels just as at home on fast tarmac as it does on rough, loose tracks.', 'Climbs feel effortless and descents feel thrilling, whatever the surface.'],
    close: ['Your next adventure starts here.', 'Don’t miss the chance to own this exceptional performer.'],
    pursuits: 'chasing gravel epics or discovering hidden routes',
  },
  cx: {
    kind: 'cyclocross bike',
    hooks: ['Discover the art of cyclocross mastery with this stunning {name}.'],
    ride: ['It commands every corner, every climb and every technical section with effortless control.'],
    close: ['Your next victory starts here.'],
    pursuits: 'entering your first race or adding a proven performer to your stable',
  },
  mtb: {
    kind: 'mountain bike',
    hooks: ['Unleash your wild side with this stunning {name}.', 'Experience the rush of the trail with this exceptional {name}.'],
    ride: ['It climbs with purpose and descends with confidence, keeping you in control when the trail gets rowdy.'],
    close: ['The trail is calling.', 'Your next big day out starts here.'],
    pursuits: 'hunting new lines or riding your local favourites',
  },
  ebike: {
    kind: 'electric bike',
    hooks: ['Experience riding without limits on this stunning {name}.', 'Go further and faster than ever with this exceptional {name}.'],
    ride: ['Natural, smooth assistance flattens hills and stretches every ride further.'],
    close: ['Ride further. Smile wider.', 'Your next adventure is fully charged.'],
    pursuits: 'commuting, exploring or keeping up with faster friends',
  },
  city: {
    kind: 'bike',
    hooks: ['Make every journey a pleasure with this smart {name}.'],
    ride: ['Comfortable, dependable and easy to live with, it makes every trip something to look forward to.'],
    close: ['Ready to ride from day one.'],
    pursuits: 'commuting, running errands or weekend exploring',
  },
  tt: {
    kind: 'time trial bike',
    hooks: ['Experience raw, aerodynamic speed with this exceptional {name}.'],
    ride: ['Every watt translates into velocity, made for the race of truth.'],
    close: ['Your fastest times start here.'],
    pursuits: 'racing against the clock or chasing triathlon glory',
  },
  other: {
    kind: 'bike',
    hooks: ['Experience the thrill of riding with this stunning {name}.'],
    ride: ['It rewards every pedal stroke with responsiveness and confidence.'],
    close: ['Ready to elevate your ride.'],
    pursuits: 'chasing personal bests or discovering new routes',
  },
};

export interface DescriptionInput { bike: any; parts?: Part[]; seed?: number }

export function generateDescription({ bike, parts = [], seed = 0 }: DescriptionInput): string {
  const fam = familyOf(bike);
  const bank = BANK[fam];
  const r = hash(String(bike?.id ?? bike?.model ?? '')) + seed;
  const pick = <T,>(arr: T[], salt: number) => arr[(r + salt) % arr.length];
  const spec = bike?.spec_values || {};
  const bySlot: Record<string, Part> = {};
  parts.forEach((p) => { if (p?.slot) bySlot[p.slot] = p; });
  const all = parts.map((p) => `${p.brand ?? ''} ${p.model ?? ''} ${p.description ?? ''}`).join(' ');

  const name = clean([bike?.make, bike?.model].filter(Boolean).join(' ')) || 'bike';
  const year = clean(bike?.year);
  const material = clean(spec?.frame?.material || bike?.frame_material);
  const matLc = material.toLowerCase();
  const size = clean(spec?.frame?.size || bike?.size);
  const colour = clean(bike?.colour);
  const weight = Number(bike?.weight_kg) || 0;
  const cond = CONDITION[lc(bike?.condition)] || '';

  // Drivetrain
  const groupset = clean(spec?.drivetrain?.groupset) || partLabel(bySlot.groupset) || partLabel(bySlot.rear_derailleur) || partLabel(bySlot.shifters);
  const electronic = /\b(di2|axs|etap|eps)\b/i.test(`${groupset} ${all}`);
  const wireless = /\b(axs|etap)\b/i.test(`${groupset} ${all}`);
  const speeds = Number(spec?.drivetrain?.speed) || 0;
  // Brakes
  const brakeText = `${spec?.brakes?.type ?? ''} ${partLabel(bySlot.brakes)} ${bySlot.brakes?.description ?? ''}`.toLowerCase();
  const disc = /disc|rotor/.test(brakeText) || !!bySlot.disc_rotors;
  const hydraulic = /hydraulic/.test(brakeText);
  const rim = /\brim\b/.test(brakeText);
  // Rolling stock
  const wheels = partLabel(bySlot.wheelset);
  const tyre = partLabel(bySlot.front_tyre) || partLabel(bySlot.rear_tyre);
  const fork = partLabel(bySlot.fork);
  const shock = partLabel(bySlot.rear_shock);
  const power = partLabel(bySlot.power_meter);
  const saddle = partLabel(bySlot.saddle);
  const motor = partLabel(bySlot.ebike_system) || clean([spec?.ebike?.motor_brand, spec?.ebike?.motor_model].filter(Boolean).join(' '));
  const battery = Number(spec?.ebike?.battery_wh) || 0;

  const paras: string[] = [];

  // 1. Hook + chassis
  const yearName = year ? `${year} ${name}` : name;
  const p1: string[] = [pick(bank.hooks, 1).replace('{name}', yearName)];
  if (matLc.includes('carbon')) p1.push(pick([`This featherweight carbon machine delivers an intoxicating blend of agility and stability.`, `The carbon frame delivers lightweight agility without sacrificing strength.`], 2));
  else if (matLc.includes('titanium')) p1.push('Its titanium frame offers a timeless, lively ride that will last a lifetime.');
  else if (matLc.includes('steel') || matLc.includes('chromoly')) p1.push('Its steel frame delivers the smooth, springy ride quality riders have loved for generations.');
  else if (matLc.includes('alumin')) p1.push('The premium aluminium frame is stiff, responsive and built to deliver explosive power when you need it.');
  if (fork && fam !== 'mtb') { /* mentioned with suspension below for MTB */ }
  paras.push(p1.join(' '));

  // 2. Drivetrain + brakes (+ e-bike system)
  const p2: string[] = [];
  if (fam === 'ebike' && motor) p2.push(`The ${motor} system${battery ? ` with its ${battery}Wh battery` : ''} gives you smooth, natural assistance whenever you want it.`);
  if (groupset) {
    const g = groupset.replace(/\bgroupset\b/i, '').trim();
    if (wireless) p2.push(`${g} wireless electronic shifting puts lightning-fast, precise gear changes at your fingertips — no cables, no compromises.`);
    else if (electronic) p2.push(`${g} electronic shifting delivers flawless, instant gear changes at the touch of a button.`);
    else p2.push(`The ${g} drivetrain ensures seamless, dependable gear changes${speeds ? ` across all ${speeds} speeds` : ''}.`);
  }
  if (disc) p2.push(`${hydraulic ? 'Hydraulic disc brakes' : 'Disc brakes'} give you commanding control in any condition.`);
  else if (rim) p2.push('Reliable rim brakes keep everything light and simple.');
  if (power) p2.push(`The integrated ${power} power meter lets you train smarter and track every watt.`);
  if (p2.length) paras.push(p2.join(' '));

  // 3. Rolling stock / suspension
  const p3: string[] = [];
  if (fam === 'mtb' && (fork || shock)) p3.push(`${[fork, shock].filter(Boolean).join(' and ')} suspension soak${fork && shock ? '' : 's'} up the rough stuff so you can stay fast and in control.`);
  if (wheels && tyre) p3.push(`${wheels} wheels paired with ${tyre} tyres create a platform that rewards every pedal stroke with responsiveness and confidence.`);
  else if (wheels) p3.push(`The ${wheels} wheelset rolls with impressive efficiency.`);
  else if (tyre) p3.push(`${tyre} tyres grip with confidence and roll beautifully.`);
  if (saddle && (r % 2 === 0)) p3.push(`A ${saddle} saddle keeps you comfortable mile after mile.`);
  p3.push(pick(bank.ride, 3));
  paras.push(p3.join(' '));

  // 4. Size / colour / weight / condition
  const p4: string[] = [];
  const facts: string[] = [];
  if (weight) facts.push(`at just ${weight}kg`);
  if (size) facts.push(`in a ${size} frame`);
  if (colour) facts.push(`finished in ${colour}`);
  if (facts.length) p4.push(`${facts.join(', ').replace(/^./, (c) => c.toUpperCase())}, this ${bank.kind} is ready for riders ${bank.pursuits}.`);
  else p4.push(`Whether you're ${bank.pursuits}, this ${bank.kind} delivers.`);
  if (cond) p4.push(cond === 'brand new' ? 'Brand new and ready to ride.' : `In ${cond} condition and ready to ride.`);
  p4.push(pick(bank.close, 4));
  paras.push(p4.join(' '));

  return paras.join('\n\n');
}
