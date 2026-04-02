export const TERMS = ["Fall", "Spring", "Summer"] as const;
export type Term = (typeof TERMS)[number];

export const DEGREE_TYPES = [
  "BS",
  "BA",
  "Minor",
  "Certificate",
  "MS",
  "PhD",
  "Graduate Certificate",
  "Doctor of Philosophy",
  "Master of Science",
  "Professional Master of Science and Technology",
  "Master of Education",
  "Master of Arts/Master of Science",
  "Bachelor of Fine Arts",
  "Bachelor of Music",
] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];
