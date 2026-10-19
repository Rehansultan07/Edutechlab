export type FeatureKey =
  | "students"
  | "id_cards"
  | "certificates"
  | "academics"
  | "timetable"
  | "homework"
  | "teachers"
  | "attendance"
  | "fees"
  | "expenses"
  | "exams"
  | "notices"
  | "staff";

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  category: "Core Operations" | "Academics & Routine" | "Administration & Security" | "Finance & Accounts";
  description: string;
  path: string;
  defaultEnabled: boolean;
}

export const PLATFORM_FEATURES: FeatureDefinition[] = [
  {
    key: "students",
    name: "Student Admission & Directory",
    category: "Core Operations",
    description: "Enroll students, manage student profiles, roll numbers, and bulk CSV import.",
    path: "/students",
    defaultEnabled: true,
  },
  {
    key: "teachers",
    name: "Teacher & Faculty Directory",
    category: "Core Operations",
    description: "Manage teaching staff records, contact info, and subject allocations.",
    path: "/teachers",
    defaultEnabled: true,
  },
  {
    key: "attendance",
    name: "Daily Attendance Tracker",
    category: "Core Operations",
    description: "Record daily present/absent roll calls and view realtime percentage metrics.",
    path: "/attendance",
    defaultEnabled: true,
  },
  {
    key: "academics",
    name: "Academics, Classes & Sections",
    category: "Academics & Routine",
    description: "Configure academic sessions, classes, and sections.",
    path: "/academics",
    defaultEnabled: true,
  },
  {
    key: "timetable",
    name: "Class Timetable & Routine",
    category: "Academics & Routine",
    description: "Manage 8-period daily routines for all classes with teacher and room assignments.",
    path: "/timetable",
    defaultEnabled: true,
  },
  {
    key: "homework",
    name: "Daily Homework & Class Diary",
    category: "Academics & Routine",
    description: "Post subject-wise daily assignments and 1-click copy WhatsApp formatted diaries for parents.",
    path: "/homework",
    defaultEnabled: true,
  },
  {
    key: "exams",
    name: "Exams & Results",
    category: "Academics & Routine",
    description: "Schedule school examinations, input subject marks, and print report cards.",
    path: "/exams",
    defaultEnabled: true,
  },
  {
    key: "id_cards",
    name: "Student ID Card Generator",
    category: "Administration & Security",
    description: "Generate and print 8-per-page A4 ID cards with barcodes, QR codes, and custom school themes.",
    path: "/id-cards",
    defaultEnabled: true,
  },
  {
    key: "certificates",
    name: "Certificates & TC Generator",
    category: "Administration & Security",
    description: "Issue Transfer Certificates (TC), Character Certificates, and Bonafide Certificates with legal borders.",
    path: "/certificates",
    defaultEnabled: true,
  },
  {
    key: "notices",
    name: "Digital Noticeboard",
    category: "Administration & Security",
    description: "Publish circulars and school announcements visible across the school portal.",
    path: "/notices",
    defaultEnabled: true,
  },
  {
    key: "staff",
    name: "Staff & Permissions",
    category: "Administration & Security",
    description: "Manage admin users, sub-roles, and granular permission access.",
    path: "/staff",
    defaultEnabled: true,
  },
  {
    key: "fees",
    name: "Fees Collection & Invoices",
    category: "Finance & Accounts",
    description: "Record student fee collections, generate printable payment receipts and monthly totals.",
    path: "/fees",
    defaultEnabled: true,
  },
  {
    key: "expenses",
    name: "School Expenses & Kharcha Tracker",
    category: "Finance & Accounts",
    description: "Track operational expenses (salaries, bills, rent, fuel) and calculate net cash operating surplus.",
    path: "/expenses",
    defaultEnabled: true,
  },
];

export type EnabledFeaturesMap = Record<FeatureKey, boolean>;

export function getDefaultFeaturesMap(): EnabledFeaturesMap {
  const map: Partial<EnabledFeaturesMap> = {};
  PLATFORM_FEATURES.forEach((f) => {
    map[f.key] = f.defaultEnabled;
  });
  return map as EnabledFeaturesMap;
}

export function parseFeatures(raw: any): EnabledFeaturesMap {
  const defaults = getDefaultFeaturesMap();
  if (!raw || typeof raw !== "object") return defaults;
  const result: Partial<EnabledFeaturesMap> = { ...defaults };
  for (const f of PLATFORM_FEATURES) {
    if (typeof raw[f.key] === "boolean") {
      result[f.key] = raw[f.key];
    }
  }
  return result as EnabledFeaturesMap;
}

export async function fetchInstitutionFeatures(
  supabase: any,
  orgId: string
): Promise<EnabledFeaturesMap> {
  // 1. Try local storage cache first for instant synchronous response
  let cached: EnabledFeaturesMap | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`edutechlab_features_${orgId}`);
      if (raw) cached = parseFeatures(JSON.parse(raw));
    } catch {}
  }

  // 2. Query Supabase
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("enabled_features")
      .eq("id", orgId)
      .maybeSingle();

    if (!error && data?.enabled_features) {
      const parsed = parseFeatures(data.enabled_features);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`edutechlab_features_${orgId}`, JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    }
  } catch {}

  return cached || getDefaultFeaturesMap();
}

export const PRESET_BUNDLES = {
  all: {
    label: "Enterprise Full Suite (13/13)",
    description: "All platform modules and power pack features enabled.",
    features: getDefaultFeaturesMap(),
  },
  academic_standard: {
    label: "Standard School Pack (9/13)",
    description: "Essential academic routine, fees, attendance, students, notices, and exams.",
    features: {
      students: true,
      id_cards: true,
      certificates: true,
      academics: true,
      timetable: true,
      homework: true,
      teachers: true,
      attendance: true,
      fees: true,
      expenses: false,
      exams: true,
      notices: true,
      staff: false,
    } as EnabledFeaturesMap,
  },
  basic_lite: {
    label: "Basic Lite Pack (5/13)",
    description: "Minimal starter pack for coaching centers or primary schools.",
    features: {
      students: true,
      id_cards: false,
      certificates: false,
      academics: true,
      timetable: false,
      homework: false,
      teachers: true,
      attendance: true,
      fees: true,
      expenses: false,
      exams: false,
      notices: true,
      staff: false,
    } as EnabledFeaturesMap,
  },
};
