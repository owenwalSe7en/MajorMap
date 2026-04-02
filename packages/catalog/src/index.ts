export { fetchAll } from "./sources/coursedog.js";
export { seed } from "./seed.js";
export { courseUuid, programUuid, departmentUuid, universityUuid } from "./uuid.js";
export { normalizeCourse, buildCourseGroupIdMap } from "./normalizers/courses.js";
export { normalizeProgram } from "./normalizers/programs.js";
export { normalizePrerequisites } from "./normalizers/prerequisites.js";
