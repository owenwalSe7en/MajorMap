# Coursedog API — University of Utah

## Discovery Summary

The University of Utah catalog at `catalog.utah.edu` is a Nuxt.js SSR app powered by **Coursedog**. The Coursedog REST API is accessible with `Referer` and `Origin` headers set to `https://catalog.utah.edu`.

## Key Identifiers

| Field             | Value                  |
| ----------------- | ---------------------- |
| School ID         | `utah_peoplesoft`      |
| Active Catalog ID | `Qv3fMzzbHWUO6lkzqwgg` |
| Catalog Label     | `2026-2027 Catalog`    |
| Institution       | `UOFU`                 |

## Endpoints

### Base URL

```
https://app.coursedog.com/api/v1/cm/utah_peoplesoft
```

### Required Headers

```
Referer: https://catalog.utah.edu/
Origin: https://catalog.utah.edu
```

### Courses

```
GET /courses/search/$filters?catalogId={catalogId}&limit={n}&skip={n}&subjectCode={code}
```

- `catalogId` (required): `Qv3fMzzbHWUO6lkzqwgg`
- `limit`: max results (default varies)
- `skip`: pagination offset
- `subjectCode`: e.g. `CS`, `MATH`, `ACCTG`

**Response**: `{ listLength: number, data: Course[] }`

**Total courses**: ~18,570

### Programs

```
GET /programs/search/$filters?catalogId={catalogId}&limit={n}
```

**Response**: `{ listLength: number, data: Program[] }`

**Total programs**: ~593

## Course Data Shape (key fields)

```typescript
interface CoursedogCourse {
  _id: string; // "0067081-2020-03-01"
  code: string; // "CS3500"
  subjectCode: string; // "CS"
  courseNumber: string; // "3500"
  name: string; // Short name: "Software Practice"
  longName: string; // Full name: "Software Practice"
  description: string; // Catalog description
  credits: {
    numberOfCredits: number; // 4
    creditHours: { min: number; max: number };
    repeatable: boolean;
  };
  departments: string[]; // ["CP SC"]
  college: string; // "EN - J & M Price College of Eng."
  career: string; // "Undergraduate Semester"
  institutionId: string; // "205823" — used in prereq references
  courseGroupId: string; // "2058231" — also used in prereq references
  requisites: {
    requisitesSimple: RequisiteGroup[];
  };
  courseTypicallyOffered: string;
  components: Component[]; // LEC, LAB, etc.
  gradeMode: string; // "SEM - Graded"
  sourceUrl?: string;
}
```

## Prerequisite Structure

Prerequisites are in `course.requisites.requisitesSimple[]`:

```typescript
interface RequisiteGroup {
  id: string;
  name: string; // "Required Prerequisites"
  type: string; // "Prerequisite" | "Corequisite"
  showInCatalog: boolean;
  rules: RequisiteRule[];
}

interface RequisiteRule {
  id: string;
  condition: "minimumGrade" | "completedAnyOf" | "completedAllOf" | "anyOf" | "allOf";
  value?: {
    condition: "courses";
    values: { value: string[]; logic: "and" | "or" }[];
  };
  grade?: string; // "C-", "B-", etc.
  gradeType?: string; // "Grade"
  subRules?: RequisiteRule[]; // nested for anyOf/allOf
}
```

**Cross-referencing**: Prereq `values[].value[]` contain `courseGroupId` strings. To resolve to actual courses, look up by `courseGroupId` in the courses list.

### Example: CS 3500 Prerequisites

- CS 2420 (courseGroupId: 2058231) with grade B-
- MATH 2210 (courseGroupId: 2017511) with grade C
- One of: CS 1400 (0184791) OR CS 1410 (0187461) OR CS 1420 (2058221) with grade C-

## Program Data Shape (key fields)

```typescript
interface CoursedogProgram {
  _id: string; // "CPSCBS-2025-04-01"
  code: string; // "CPSCBS"
  catalogDisplayName: string; // "Computer Science"
  catalogDescription: string; // "Bachelor of Science"
  catalogFullDescription: string; // HTML description
  college: string;
  departments: string[];
  level: string; // "Bachelor of Science"
  type: string; // "Undergraduate Major"
  programLengthValue: number; // 120 (total credits)
  degreeMaps: DegreeMap[]; // Sample 4-year plans
  requisites: {
    requisitesSimple: ProgramRequisiteGroup[]; // Required coursework
  };
  customFields: Record<string, any>; // Contact info, admission reqs (HTML)
  learningOutcomes: LearningOutcome[];
}
```

## Degree Maps (Sample Plans)

Programs include `degreeMaps` with semester-by-semester course plans:

```typescript
interface DegreeMap {
  degreeMapName: string; // "Computer Science Sample 4 Year Plan"
  semesters: Semester[]; // 8 semesters
}

interface Semester {
  requirements: {
    requirementSelect: { type: "courses" | "courseAttributes"; value: string }[];
    area: "major" | "generalEducation";
    criticality: boolean;
  }[];
}
```

## Pagination

Both endpoints support `limit` and `skip` for pagination. To fetch all courses:

```
skip=0&limit=500
skip=500&limit=500
...
```

## Rate Limiting

No rate limiting observed in testing. Be respectful — add delays between batch requests.

## Departments

Available in the Nuxt SSR payload on any catalog page (`window.__NUXT__.state.departments.all`). 110 departments total. Each has `_id` (subject code), `name`, `subjectCodes[]`.
