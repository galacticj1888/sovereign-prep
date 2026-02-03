/**
 * Participant Profiler
 *
 * Enriches participant data with professional background,
 * role classification, and influence assessment.
 */

import { logger } from '../utils/logger.js';
import type {
  Participant,
  ParticipantRole,
  InfluenceLevel,
  Interaction,
} from '../types/index.js';
import type { PersonInfo } from '../sources/exa.js';

// --- Types ---

export interface ParticipantProfile extends Participant {
  enrichmentSource?: 'exa' | 'linkedin' | 'manual' | 'inferred';
  enrichedAt?: Date;
  confidence: number; // 0-1 score for data quality
}

export interface ProfileEnrichmentOptions {
  includeLinkedIn?: boolean;
  includeBackground?: boolean;
  inferRole?: boolean;
  inferInfluence?: boolean;
}

// --- Role Classification ---

/** Keywords that suggest different roles */
const ROLE_KEYWORDS: Record<ParticipantRole, string[]> = {
  champion: [
    'advocate',
    'sponsor',
    'supporter',
    'driving',
    'pushing',
    'excited',
    'enthusiastic',
  ],
  blocker: [
    'concern',
    'hesitant',
    'pushback',
    'skeptical',
    'opposed',
    'blocking',
    'resistant',
  ],
  'economic-buyer': [
    'budget',
    'approve',
    'sign off',
    'authorize',
    'procurement',
    'purchase',
    'contract',
    'vp',
    'director',
    'head of',
    'chief',
  ],
  'technical-evaluator': [
    'evaluate',
    'test',
    'poc',
    'proof of concept',
    'technical',
    'engineer',
    'architect',
    'developer',
    'security',
    'infrastructure',
  ],
  'decision-maker': [
    'decide',
    'final say',
    'approval',
    'executive',
    'leader',
    'manager',
    'director',
  ],
  influencer: [
    'recommend',
    'suggest',
    'advise',
    'consult',
    'stakeholder',
    'input',
  ],
  unknown: [],
};

/** Title patterns that suggest roles */
const TITLE_ROLE_PATTERNS: Array<{ pattern: RegExp; role: ParticipantRole }> = [
  { pattern: /\b(ceo|cto|cfo|coo|ciso|cio)\b/i, role: 'economic-buyer' },
  { pattern: /\b(vp|vice president|svp|evp)\b/i, role: 'economic-buyer' },
  { pattern: /\b(director|head of)\b/i, role: 'decision-maker' },
  { pattern: /\b(engineer|developer|architect)\b/i, role: 'technical-evaluator' },
  { pattern: /\b(security|infosec|cyber)\b/i, role: 'technical-evaluator' },
  { pattern: /\b(procurement|purchasing|buyer)\b/i, role: 'economic-buyer' },
  { pattern: /\b(manager)\b/i, role: 'influencer' },
  { pattern: /\b(analyst|specialist)\b/i, role: 'influencer' },
];

// --- Influence Assessment ---

/** Title patterns that suggest influence levels */
const INFLUENCE_PATTERNS: Array<{ pattern: RegExp; influence: InfluenceLevel }> = [
  { pattern: /\b(ceo|cto|cfo|coo|ciso|cio)\b/i, influence: 'high' },
  { pattern: /\b(vp|vice president|svp|evp)\b/i, influence: 'high' },
  { pattern: /\b(director|head of)\b/i, influence: 'high' },
  { pattern: /\b(senior|sr\.?|principal|staff)\b/i, influence: 'medium' },
  { pattern: /\b(manager|lead)\b/i, influence: 'medium' },
  { pattern: /\b(junior|jr\.?|associate|intern)\b/i, influence: 'low' },
];

// --- Main Profiling Functions ---

/**
 * Enrich a participant with additional profile data
 */
export function enrichParticipant(
  participant: Partial<Participant>,
  personInfo?: PersonInfo,
  options: ProfileEnrichmentOptions = {}
): ParticipantProfile {
  const log = logger.child('profiler');

  // Start with existing data
  const profile: ParticipantProfile = {
    email: participant.email ?? '',
    name: participant.name ?? personInfo?.name ?? '',
    company: participant.company ?? personInfo?.company ?? '',
    title: participant.title ?? personInfo?.title ?? '',
    role: participant.role ?? 'unknown',
    influence: participant.influence ?? 'medium',
    linkedInUrl: participant.linkedInUrl ?? personInfo?.linkedInUrl,
    background: participant.background ?? personInfo?.background,
    previousInteractions: participant.previousInteractions ?? [],
    communicationNotes: participant.communicationNotes,
    whatTheyCareAbout: participant.whatTheyCareAbout,
    lastInteractionDate: participant.lastInteractionDate,
    totalInteractions: participant.totalInteractions,
    confidence: 0.5,
  };

  // Apply enrichment from PersonInfo
  if (personInfo) {
    profile.enrichmentSource = 'exa';
    profile.enrichedAt = new Date();
    profile.confidence = 0.7;

    log.debug(`Enriched ${profile.name} from Exa`);
  }

  // Infer role from title and interactions
  if (options.inferRole !== false && profile.role === 'unknown') {
    profile.role = inferRole(profile);
    log.debug(`Inferred role for ${profile.name}: ${profile.role}`);
  }

  // Infer influence from title
  if (options.inferInfluence !== false) {
    profile.influence = inferInfluence(profile);
    log.debug(`Inferred influence for ${profile.name}: ${profile.influence}`);
  }

  // Calculate confidence score
  profile.confidence = calculateConfidence(profile);

  return profile;
}

/**
 * Profile multiple participants
 */
export function profileParticipants(
  participants: Map<string, Partial<Participant>>,
  personInfoMap?: Map<string, PersonInfo>,
  options: ProfileEnrichmentOptions = {}
): Map<string, ParticipantProfile> {
  const log = logger.child('profiler');
  const profiles = new Map<string, ParticipantProfile>();

  for (const [email, participant] of participants) {
    const personInfo = personInfoMap?.get(email);
    const profile = enrichParticipant(participant, personInfo, options);
    profiles.set(email, profile);
  }

  log.info(`Profiled ${profiles.size} participants`);
  return profiles;
}

// --- Inference Functions ---

/**
 * Infer participant role from title and interaction history
 */
export function inferRole(participant: Partial<Participant>): ParticipantRole {
  const title = participant.title?.toLowerCase() ?? '';
  const interactions = participant.previousInteractions ?? [];

  // Check title patterns first
  for (const { pattern, role } of TITLE_ROLE_PATTERNS) {
    if (pattern.test(title)) {
      return role;
    }
  }

  // Check interaction content for role keywords
  const allText = interactions
    .map(i => `${i.title ?? ''} ${i.summary ?? ''}`)
    .join(' ')
    .toLowerCase();

  let bestRole: ParticipantRole = 'unknown';
  let bestScore = 0;

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    const score = keywords.filter(k => allText.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestRole = role as ParticipantRole;
    }
  }

  return bestRole;
}

/**
 * Infer influence level from title and engagement
 */
export function inferInfluence(participant: Partial<Participant>): InfluenceLevel {
  const title = participant.title?.toLowerCase() ?? '';
  const interactionCount = participant.totalInteractions ?? 0;

  // Check title patterns
  for (const { pattern, influence } of INFLUENCE_PATTERNS) {
    if (pattern.test(title)) {
      return influence;
    }
  }

  // Default based on engagement level
  if (interactionCount >= 5) return 'high';
  if (interactionCount >= 2) return 'medium';
  return 'low';
}

/**
 * Calculate confidence score for a profile
 */
function calculateConfidence(profile: ParticipantProfile): number {
  let score = 0;
  let factors = 0;

  // Name present
  if (profile.name) {
    score += 1;
    factors += 1;
  }

  // Title present
  if (profile.title) {
    score += 1;
    factors += 1;
  }

  // Company present
  if (profile.company) {
    score += 1;
    factors += 1;
  }

  // LinkedIn present
  if (profile.linkedInUrl) {
    score += 1;
    factors += 1;
  }

  // Background present
  if (profile.background) {
    score += 1;
    factors += 1;
  }

  // Has interactions
  if (profile.previousInteractions.length > 0) {
    score += 1;
    factors += 1;
  }

  // Role identified (not unknown)
  if (profile.role !== 'unknown') {
    score += 0.5;
    factors += 1;
  }

  return factors > 0 ? score / factors : 0;
}

// --- Analysis Functions ---

/**
 * Analyze interactions to extract what the participant cares about
 */
export function analyzeInterests(interactions: Interaction[]): string[] {
  const interests: Set<string> = new Set();

  // Common topic keywords to look for
  const topicKeywords = [
    { keyword: 'security', topic: 'Security' },
    { keyword: 'compliance', topic: 'Compliance' },
    { keyword: 'performance', topic: 'Performance' },
    { keyword: 'cost', topic: 'Cost' },
    { keyword: 'budget', topic: 'Budget' },
    { keyword: 'timeline', topic: 'Timeline' },
    { keyword: 'velocity', topic: 'Team velocity' },
    { keyword: 'scalab', topic: 'Scalability' },
    { keyword: 'integrat', topic: 'Integration' },
    { keyword: 'deploy', topic: 'Deployment' },
    { keyword: 'governance', topic: 'Governance' },
    { keyword: 'audit', topic: 'Audit' },
    { keyword: 'observab', topic: 'Observability' },
  ];

  for (const interaction of interactions) {
    const text = `${interaction.summary ?? ''} ${interaction.keyPoints?.join(' ') ?? ''}`.toLowerCase();

    for (const { keyword, topic } of topicKeywords) {
      if (text.includes(keyword)) {
        interests.add(topic);
      }
    }
  }

  return Array.from(interests);
}

/**
 * Generate communication notes based on interactions
 */
export function generateCommunicationNotes(
  profile: ParticipantProfile
): string | undefined {
  const notes: string[] = [];

  // Based on role
  const roleNotes: Record<string, string> = {
    'technical-evaluator': 'Lead with technical depth and specifics.',
    'economic-buyer': 'Focus on ROI, business value, and outcomes.',
    'champion': 'They are an advocate - keep them informed and engaged.',
    'blocker': 'Address their concerns directly and proactively.',
  };
  const roleNote = roleNotes[profile.role];
  if (roleNote) notes.push(roleNote);

  // Based on influence
  if (profile.influence === 'high') {
    notes.push('Key stakeholder - ensure executive-level communication.');
  }

  // Based on interaction history
  if (profile.totalInteractions && profile.totalInteractions >= 5) {
    notes.push('Well-established relationship.');
  } else if (!profile.totalInteractions || profile.totalInteractions === 0) {
    notes.push('New contact - introduce yourself and establish rapport.');
  }

  return notes.length > 0 ? notes.join(' ') : undefined;
}

/**
 * Identify missing stakeholders based on typical deal structure
 */
export function identifyMissingStakeholders(
  profiles: Map<string, ParticipantProfile>
): string[] {
  const profileArray = Array.from(profiles.values());
  const hasRole = (role: string): boolean => profileArray.some(p => p.role === role);

  const requiredRoles: Array<{ role: string; message: string }> = [
    { role: 'economic-buyer', message: 'Economic buyer not yet identified' },
    { role: 'technical-evaluator', message: 'Technical evaluator not yet engaged' },
    { role: 'champion', message: 'No clear champion identified' },
  ];

  return requiredRoles.filter(r => !hasRole(r.role)).map(r => r.message);
}
