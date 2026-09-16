export type Role = 'recruiter' | 'applicant';
export interface User {
  id: string;
  name: string;
  role: Role;
}
export type Category = '기술 역량' | '경험' | '협업' | '우대사항';
export const categories: Category[] = ['기술 역량', '경험', '협업', '우대사항'];
export interface Job {
  profileCatalogVersion?: string;
  id: string;
  companyName: string;
  title: string;
  role: string;
  description: string;
  createdAt: string;
  location: string;
  employmentType: string;
  minExperience: number;
}
export interface EvaluationCriterion {
  catalogCriterionId?: string;
  id: string;
  jobId: string;
  category: Category;
  name: string;
  description: string;
  weight: number;
  required: boolean;
  keywords: string[];
}
export interface Candidate {
  id: string;
  name: string;
  email: string;
}
export type ReviewStatus = 'NEW' | 'REVIEWED' | 'SHORTLISTED';
export const reviewLabels: Record<ReviewStatus, string> = {
  NEW: '검토 전',
  REVIEWED: '검토 완료',
  SHORTLISTED: '면접 검토',
};
export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  experience: number;
  skills: string;
  projects: string;
  introduction: string;
  motivation: string;
  collaboration: string;
  additionalExperience: string;
  createdAt: string;
  status: ReviewStatus;
  resumeSource?: ResumeSource;
}
export type ApplicationInput = Omit<
  Application,
  'id' | 'candidateId' | 'jobId' | 'createdAt' | 'status' | 'resumeSource'
> & { name: string; email: string };
export interface ResumeSource {
  versionId: string;
  title: string;
  revision: number;
}
export interface ResumeVersion {
  id: string;
  title: string;
  content: ApplicationInput;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export type EvaluationLevel = 'Strong' | 'Good' | 'Partial' | 'Unverified';
export interface EvaluationItem {
  evidenceLevel?: number;
  keywordMatches?: import('@/lib/evaluation/keyword-contract').KeywordMatch[];
  id: string;
  evaluationId: string;
  criterionId: string;
  score: number;
  maxScore: number;
  level: EvaluationLevel;
  evidence: string | null;
  reason: string;
}
export type ActionType =
  | 'CERTIFICATION'
  | 'INTERNSHIP'
  | 'PROJECT'
  | 'TEAM_PROJECT'
  | 'RESUME_IMPROVEMENT'
  | 'PORTFOLIO'
  | 'LEARNING';
export interface ActionLink {
  label: string;
  resourceType: ActionType;
}
export interface ImprovementAction {
  id: string;
  evaluationId: string;
  criterionId: string;
  type: ActionType;
  title: string;
  description: string;
  reason: string;
  priority: number;
  estimatedScoreImpact: number;
  links: ActionLink[];
}
export interface Evaluation {
  id: string;
  applicationId: string;
  totalScore: number;
  summary: string;
  recommendation: string;
  requiredMet: boolean;
  categoryScores: Record<Category, number>;
  items: EvaluationItem[];
  actions: ImprovementAction[];
  evaluatedAt: string;
  evaluatorVersion: string;
}
export type EvaluationResult = Evaluation;
export interface Database {
  version: 2;
  resumes: ResumeVersion[];
  jobs: Job[];
  criteria: EvaluationCriterion[];
  candidates: Candidate[];
  applications: Application[];
  evaluations: Evaluation[];
  completedActionIds: string[];
  ownApplicationIds: string[];
}
export interface CandidateRow {
  candidate: Candidate;
  application: Application;
  evaluation: Evaluation;
}
