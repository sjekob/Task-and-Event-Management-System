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
