// Iridology zone definitions — simplified composite chart blending
// Bernard Jensen's "Iridology Simplified" and Henry Lindlahr's "Iridiagnosis" (1919, public domain).
// IMPORTANT: Iridology is not medically validated. This is for educational use only.

export interface IrisZone {
  hour: number; // clock position 1-12
  rightEye: string; // organ/system for the right iris
  leftEye: string;
  note: string;
}

// Clock-position mapping (approximate composite, viewer's perspective).
export const IRIS_ZONES: IrisZone[] = [
  { hour: 12, rightEye: "Cerebrum / forebrain", leftEye: "Cerebrum / forebrain", note: "Mental activity, anxiety patterns (Jensen)." },
  { hour: 1,  rightEye: "Forehead, sinus, face", leftEye: "Cerebellum, equilibrium", note: "Sinus congestion appears as cloudy fibers." },
  { hour: 2,  rightEye: "Throat, thyroid, ear", leftEye: "Speech, throat, ear", note: "Lindlahr links density here to chronic catarrh." },
  { hour: 3,  rightEye: "Bronchi, lungs (right)", leftEye: "Heart, chest (left lung)", note: "Heart sign appears only in the left iris." },
  { hour: 4,  rightEye: "Liver, gallbladder", leftEye: "Spleen, diaphragm", note: "Yellow/brown pigment often noted over liver zone." },
  { hour: 5,  rightEye: "Stomach, pancreas (head)", leftEye: "Stomach, pancreas (tail)", note: "Inner ring (collarette) maps the digestive tract." },
  { hour: 6,  rightEye: "Kidney, adrenal, bladder", leftEye: "Kidney, adrenal, bladder", note: "Dark crypts here flagged classically as kidney weakness." },
  { hour: 7,  rightEye: "Sciatic, lower colon", leftEye: "Sciatic, lower colon", note: "Bowel pockets / 'lacunae' historically read here." },
  { hour: 8,  rightEye: "Reproductive (right)", leftEye: "Reproductive (left)", note: "Hormonal / pelvic region." },
  { hour: 9,  rightEye: "Liver lobe, ribs", leftEye: "Heart base, ribs", note: "Lindlahr's 'nerve rings' often radiate from this band." },
  { hour: 10, rightEye: "Shoulder, arm", leftEye: "Shoulder, arm", note: "Tension and posture indicators." },
  { hour: 11, rightEye: "Cerebellum, balance", leftEye: "Forehead, sinus, face", note: "Note the mirror symmetry between irises." },
];

// Three concentric rings of the iris per Jensen.
export const IRIS_RINGS = [
  { name: "Stomach ring", innerPct: 0,  outerPct: 18, description: "Innermost band around pupil — digestive function." },
  { name: "Intestinal / autonomic", innerPct: 18, outerPct: 32, description: "Collarette zone — intestines & autonomic nerve wreath." },
  { name: "Organ zone",   innerPct: 32, outerPct: 70, description: "Main organ territory mapped by clock position." },
  { name: "Lymph & skin", innerPct: 70, outerPct: 100, description: "Outer rings — circulation, lymphatic, skin." },
];
