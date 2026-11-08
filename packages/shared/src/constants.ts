/** Coordinator delegation choices, grouped by category. */
export const COORDINATOR_TYPE_GROUPS: Record<string, string[]> = {
  'Subject & Curriculum': [
    'Filipino Coordinator',
    'English Coordinator',
    'Araling Panlipunan (Social Studies) Coordinator',
    'Science Coordinator',
    'Mathematics Coordinator',
    'EPP (Edukasyong Pantahanan at Pangkabuhayan) Coordinator',
    'MAPEH (Music, Arts, Physical Education, and Health) Coordinator',
  ],
  'Program & Special Project': [
    'SSES Coordinator',
    'SBFP Coordinator',
    'Brigada Eskwela Coordinator',
    'Disaster Risk Reduction and Management (DRRM) Coordinator',
    'Feeding Program Coordinator',
    'Gulayan sa Paaralan Coordinator',
    'School Health Focal Person',
    'Youth for Environment in Schools Organization (YES-O) Coordinator',
  ],
  'Student & Extracurricular': [
    'Supreme Elementary Learner Government (SELG) Adviser',
    'Girl Scout Coordinator',
    'Twinkler Coordinator',
    'Star Scout Coordinator',
    'Boy Scout Coordinator',
    'KAB Scout Coordinator',
    'Kid Scout Coordinator',
    'School Paper Adviser',
  ],
  'Administrative & Support': [
    'Property Custodian',
    'Library Coordinator',
    'School Testing Coordinator',
    'ICT (Information and Communications Technology) Coordinator',
    'LIS (Learner Info System) Coordinator',
    'School Information Coordinator',
    'School Assessment Coordinator',
    'Gender and Development (GAD) Coordinator',
    'External Partnership Focal Person',
  ],
};

/** Roles the principal can give an account in Personnel. */
export const ASSIGNABLE_ACCOUNT_ROLES = ['principal', 'coordinator', 'dean', 'registrar', 'teacher'] as const;

/**
 * How often open event screens (lists, details, calendars, attendance) refresh,
 * in ms (paper FR 4.3.1: at least every 30 seconds). Web and mobile share it.
 */
export const EVENT_REFRESH_MS = 30_000;

/**
 * React Query options for event screens that should stay current: poll every
 * EVENT_REFRESH_MS while visible, refetch as soon as the user comes back, and
 * pause while the tab / app is in the background. Not for forms being edited.
 */
export const LIVE_EVENT_QUERY = {
  refetchInterval: EVENT_REFRESH_MS,
  refetchIntervalInBackground: false,
  // 'always': refetch on return even if the last fetch was under staleTime ago.
  refetchOnWindowFocus: 'always',
} as const;

/** For editing screens: never refetch underneath what the user is typing. */
export const NO_LIVE_REFRESH = {
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
