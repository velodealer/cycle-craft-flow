import BikeLabels, { type LabelBike } from './BikeLabels';

interface BikeLabelProps {
  bike: LabelBike;
  onClose: () => void;
}

export default function BikeLabel({ bike, onClose }: BikeLabelProps) {
  return <BikeLabels bikes={[bike]} onClose={onClose} />;
}
