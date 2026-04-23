import { prepareTranscriptForAnalysis } from './analysis/transcriptPreparationService.js';
import { generateStructuredAnalysis } from './analysis/transcriptAnalysisGenerator.js';
import { ANALYSIS_VERSION, validateAndNormalizeAnalysis } from './analysis/transcriptAnalysisValidator.js';

export async function analyzeTranscript({ title, durationSeconds, transcript, transcriptText }) {
  const prepared = prepareTranscriptForAnalysis({ transcript, transcriptText, durationSeconds });

  if (!prepared.isEligible) {
    return {
      analysisStatus: 'skipped',
      analysisVersion: ANALYSIS_VERSION,
      analyzedAt: new Date(),
      synopsis: null,
      keyPoints: [],
      entities: {
        people: [],
        organizations: [],
        places: [],
        programs: [],
        issues: []
      },
      tags: [],
      sections: [],
      notableQuotes: [],
      analysisReason: prepared.reason
    };
  }

  const candidate = await generateStructuredAnalysis({
    title,
    transcriptText: prepared.normalizedText,
    entries: prepared.entries
  });

  return validateAndNormalizeAnalysis(candidate);
}
