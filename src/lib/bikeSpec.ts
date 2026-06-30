// Bike specification schema definitions.
// `spec_values` is a free-form JSONB on `bikes`. This module describes the
// shape we render in the UI without forcing a DB schema change every time a
// manufacturer introduces a new attribute.

export const BIKE_TYPES: { value: string; label: string }[] = [
  { value: 'road', label: 'Road' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'mtb_hardtail', label: 'MTB — Hardtail' },
  { value: 'mtb_full_sus', label: 'MTB — Full Suspension' },
  { value: 'bmx', label: 'BMX' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'city', label: 'City' },
  { value: 'electric', label: 'Electric' },
  { value: 'folding', label: 'Folding' },
  { value: 'cargo', label: 'Cargo' },
  { value: 'tt', label: 'Time Trial / Triathlon' },
  { value: 'touring', label: 'Touring' },
  { value: 'cyclocross', label: 'Cyclocross' },
  { value: 'track', label: 'Track' },
  { value: 'tandem', label: 'Tandem' },
  { value: 'recumbent', label: 'Recumbent' },
  { value: 'kids', label: "Children's" },
];

export const FRAME_MATERIALS = ['Carbon', 'Aluminium', 'Steel', 'Titanium', 'Chromoly', 'Bamboo', 'Other'];
export const GENDERS = ['Unisex', 'Male', 'Female', 'Kids'];
export const CONDITIONS = ['new', 'as_new', 'excellent', 'good', 'fair'];

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'checkbox';

export interface FieldDef {
  key: string;          // dot path under section.path
  label: string;
  type?: FieldType;
  options?: string[];
  placeholder?: string;
}

export interface SlotDef {
  slot: string;          // unique key into bike_components.slot
  label: string;
  categorySlug: string;  // component_categories.slug filter
  position?: 'front' | 'rear' | 'left' | 'right';
}

export interface SectionDef {
  id: string;
  title: string;
  path: string;          // dot path inside spec_values, '' for root
  show?: (bike: any) => boolean;
  slots?: SlotDef[];
  fields?: FieldDef[];
}

const isFullSus = (b: any) => b?.bike_type === 'mtb_full_sus' || b?.has_rear_shock;
const hasFork = (b: any) =>
  b?.has_suspension_fork ||
  ['mtb_hardtail', 'mtb_full_sus', 'hybrid', 'cargo'].includes(b?.bike_type);
const isElectric = (b: any) => b?.is_electric || b?.bike_type === 'electric';
const hasDropper = (b: any) => b?.has_dropper;
const hasAccessories = (b: any) => b?.has_accessories;
const isUsed = (b: any) => b?.condition && b.condition !== 'new';

export const SPEC_SECTIONS: SectionDef[] = [
  {
    id: 'frame',
    title: 'Frame',
    path: 'frame',
    fields: [
      { key: 'material', label: 'Material', type: 'select', options: FRAME_MATERIALS },
      { key: 'size', label: 'Size' },
      { key: 'geometry', label: 'Geometry', type: 'textarea' },
      { key: 'bottom_bracket_standard', label: 'Bottom Bracket Standard' },
      { key: 'headset_standard', label: 'Headset Standard' },
      { key: 'internal_cable_routing', label: 'Internal Cable Routing', type: 'checkbox' },
      { key: 'rear_axle_standard', label: 'Rear Axle Standard' },
      { key: 'seat_clamp_diameter', label: 'Seat Clamp Diameter' },
    ],
  },
  {
    id: 'fork',
    title: 'Fork',
    path: 'fork',
    show: hasFork,
    slots: [{ slot: 'fork', label: 'Fork', categorySlug: 'fork' }],
    fields: [
      { key: 'material', label: 'Material' },
      { key: 'travel_mm', label: 'Travel (mm)', type: 'number' },
      { key: 'offset_mm', label: 'Offset (mm)', type: 'number' },
      { key: 'axle_standard', label: 'Axle Standard' },
      { key: 'lockout', label: 'Lockout', type: 'checkbox' },
    ],
  },
  {
    id: 'rear_shock',
    title: 'Rear Shock',
    path: 'rear_shock',
    show: isFullSus,
    slots: [{ slot: 'rear_shock', label: 'Rear Shock', categorySlug: 'rear_shock' }],
    fields: [
      { key: 'travel_mm', label: 'Travel (mm)', type: 'number' },
      { key: 'shock_size', label: 'Shock Size' },
      { key: 'lockout', label: 'Lockout', type: 'checkbox' },
    ],
  },
  {
    id: 'wheels',
    title: 'Wheels',
    path: 'wheels',
    slots: [{ slot: 'wheelset', label: 'Wheelset', categorySlug: 'wheels' }],
    fields: [
      { key: 'wheel_size', label: 'Wheel Size', placeholder: '700c, 29", 27.5"' },
      { key: 'rim_material', label: 'Rim Material' },
      { key: 'internal_width_mm', label: 'Internal Width (mm)', type: 'number' },
      { key: 'hub', label: 'Hub' },
      { key: 'spoke_count', label: 'Spoke Count', type: 'number' },
      { key: 'tubeless_ready', label: 'Tubeless Ready', type: 'checkbox' },
    ],
  },
  {
    id: 'tyres',
    title: 'Tyres',
    path: 'tyres',
    slots: [
      { slot: 'front_tyre', label: 'Front Tyre', categorySlug: 'tyres', position: 'front' },
      { slot: 'rear_tyre', label: 'Rear Tyre', categorySlug: 'tyres', position: 'rear' },
    ],
    fields: [
      { key: 'front_size', label: 'Front Size' },
      { key: 'rear_size', label: 'Rear Size' },
    ],
  },
  {
    id: 'drivetrain',
    title: 'Drivetrain',
    path: 'drivetrain',
    slots: [
      { slot: 'crank', label: 'Crank', categorySlug: 'crank' },
      { slot: 'cassette', label: 'Cassette', categorySlug: 'cassette' },
      { slot: 'chain', label: 'Chain', categorySlug: 'chain' },
      { slot: 'front_derailleur', label: 'Front Derailleur', categorySlug: 'front_derailleur' },
      { slot: 'rear_derailleur', label: 'Rear Derailleur', categorySlug: 'rear_derailleur' },
      { slot: 'shifters', label: 'Shifters', categorySlug: 'shifters' },
      { slot: 'bottom_bracket', label: 'Bottom Bracket', categorySlug: 'bottom_bracket' },
    ],
    fields: [
      { key: 'groupset', label: 'Groupset' },
      { key: 'speed', label: 'Speed (e.g. 12)', type: 'number' },
      { key: 'config', label: 'Setup', type: 'select', options: ['1x', '2x', '3x'] },
      { key: 'crank_length_mm', label: 'Crank Length (mm)', type: 'number' },
      { key: 'chainring', label: 'Chainring' },
      { key: 'cassette_range', label: 'Cassette Range', placeholder: '11-34T' },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes',
    path: 'brakes',
    slots: [{ slot: 'brakes', label: 'Brakes', categorySlug: 'brakes' }],
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['Hydraulic Disc', 'Mechanical Disc', 'Rim'] },
      { key: 'rotor_front_mm', label: 'Front Rotor (mm)', type: 'number' },
      { key: 'rotor_rear_mm', label: 'Rear Rotor (mm)', type: 'number' },
    ],
  },
  {
    id: 'cockpit',
    title: 'Cockpit',
    path: 'cockpit',
    slots: [
      { slot: 'handlebars', label: 'Handlebars', categorySlug: 'handlebars' },
      { slot: 'stem', label: 'Stem', categorySlug: 'stem' },
      { slot: 'grips', label: 'Grips / Bar Tape', categorySlug: 'grips' },
    ],
    fields: [
      { key: 'bar_width_mm', label: 'Bar Width (mm)', type: 'number' },
      { key: 'bar_rise_mm', label: 'Bar Rise (mm)', type: 'number' },
      { key: 'bar_material', label: 'Bar Material' },
      { key: 'stem_length_mm', label: 'Stem Length (mm)', type: 'number' },
      { key: 'stem_angle_deg', label: 'Stem Angle (°)', type: 'number' },
    ],
  },
  {
    id: 'saddle_seatpost',
    title: 'Saddle & Seatpost',
    path: 'saddle_seatpost',
    slots: [
      { slot: 'saddle', label: 'Saddle', categorySlug: 'saddle' },
      { slot: 'seatpost', label: 'Seatpost', categorySlug: 'seatpost' },
    ],
    fields: [
      { key: 'seatpost_diameter_mm', label: 'Seatpost Diameter (mm)', type: 'number' },
      { key: 'seatpost_length_mm', label: 'Seatpost Length (mm)', type: 'number' },
      { key: 'dropper_travel_mm', label: 'Dropper Travel (mm)', type: 'number' },
    ],
  },
  {
    id: 'pedals',
    title: 'Pedals',
    path: 'pedals',
    slots: [{ slot: 'pedals', label: 'Pedals', categorySlug: 'pedals' }],
    fields: [{ key: 'included', label: 'Included with bike', type: 'checkbox' }],
  },
  {
    id: 'ebike',
    title: 'E-bike System',
    path: 'ebike',
    show: isElectric,
    slots: [{ slot: 'ebike_system', label: 'Motor / System', categorySlug: 'ebike_system' }],
    fields: [
      { key: 'motor_brand', label: 'Motor Brand' },
      { key: 'motor_model', label: 'Motor Model' },
      { key: 'motor_power_w', label: 'Motor Power (W)', type: 'number' },
      { key: 'torque_nm', label: 'Torque (Nm)', type: 'number' },
      { key: 'battery_wh', label: 'Battery Capacity (Wh)', type: 'number' },
      { key: 'range_km', label: 'Estimated Range (km)', type: 'number' },
      { key: 'display', label: 'Display' },
      { key: 'charger', label: 'Charger' },
    ],
  },
  {
    id: 'accessories',
    title: 'Accessories',
    path: 'accessories',
    show: hasAccessories,
    fields: [
      { key: 'mudguards', label: 'Mudguards', type: 'checkbox' },
      { key: 'rack', label: 'Rack', type: 'checkbox' },
      { key: 'lights', label: 'Lights', type: 'checkbox' },
      { key: 'bottle_cages', label: 'Bottle Cages', type: 'checkbox' },
      { key: 'bell', label: 'Bell', type: 'checkbox' },
      { key: 'kickstand', label: 'Kickstand', type: 'checkbox' },
      { key: 'computer_mount', label: 'Computer Mount', type: 'checkbox' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'used',
    title: 'Used Bike Information',
    path: 'used',
    show: isUsed,
    fields: [
      { key: 'mileage_km', label: 'Mileage (km)', type: 'number' },
      { key: 'service_history', label: 'Service History', type: 'textarea' },
      { key: 'tyre_wear_pct', label: 'Tyre Wear %', type: 'number' },
      { key: 'brake_wear_pct', label: 'Brake Wear %', type: 'number' },
      { key: 'chain_wear_pct', label: 'Chain Wear %', type: 'number' },
      { key: 'cosmetic_condition', label: 'Cosmetic Condition', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

export function applyTypeDefaults(bikeType: string): Partial<{
  has_rear_shock: boolean;
  has_suspension_fork: boolean;
  has_dropper: boolean;
  is_electric: boolean;
}> {
  switch (bikeType) {
    case 'mtb_full_sus':
      return { has_rear_shock: true, has_suspension_fork: true, has_dropper: true };
    case 'mtb_hardtail':
      return { has_suspension_fork: true, has_dropper: true };
    case 'electric':
    case 'cargo':
      return { is_electric: true };
    case 'hybrid':
      return { has_suspension_fork: false };
    default:
      return {};
  }
}

// Dot-path helpers for nested JSON spec values.
export function getAtPath(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

export function setAtPath(obj: any, path: string, value: any): any {
  if (!path) return value;
  const out = { ...(obj || {}) };
  const keys = path.split('.');
  let cursor = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cursor[k] = { ...(cursor[k] || {}) };
    cursor = cursor[k];
  }
  cursor[keys[keys.length - 1]] = value;
  return out;
}
