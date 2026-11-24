import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { askAssistant } from '../api.ts';
import type {
  AirQualityReport,
  AssistantResponse,
  SensitivityProfile,
} from '../shared/airTypes.ts';

interface AssistantPanelProps {
  report: AirQualityReport;
  profile: SensitivityProfile;
}

const STARTER_PROMPTS = [
  'Is 6:30 PM safe for a 40-minute jog?',
  'When should I open windows for fresh air?',
  'Do I need a mask for my evening commute?',
];

export function AssistantPanel({ report, profile }: AssistantPanelProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);

  async function submitQuestion(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (trimmed.length < 3) return;

    setLoading(true);
    setError(null);
    try {
      const result = await askAssistant({
        latitude: report.latitude,
        longitude: report.longitude,
        location_name: report.location_name,
        profile,
        question: trimmed,
      });
      setResponse(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the air assistant right now. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(question);
  }

  return (
    <section
      id="assistant"
      className="bg-white border border-slate-200 rounded-xl p-6"
      aria-labelledby="assistant-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
        <div>
          <h2 id="assistant-heading" className="text-lg font-semibold text-slate-900">
            Ask the Air Assistant
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Answers are grounded strictly in {report.location_name}&apos;s live readings and 24-hour forecast.
          </p>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Active profile: {profile.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4" aria-label="Suggested questions">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(prompt);
              void submitQuestion(prompt);
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="assistant-question" className="sr-only">
          Ask a question about local air quality
        </label>
        <input
          id="assistant-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Is 6:30 PM safe for a 40-minute jog if I have mild asthma?"
          maxLength={500}
          className="flex-1 min-w-0 px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{loading ? 'Analyzing...' : 'Ask Assistant'}</span>
        </button>
      </form>

      <div aria-live="polite" className="mt-5">
        {error && (
          <p className="text-sm font-medium text-red-700 pt-3 border-t border-slate-200">
            {error}
          </p>
        )}

        {response && (
          <div className="pt-5 border-t border-slate-200 space-y-4">
            {response.notice && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {response.notice}
              </p>
            )}

            <p className="text-[15px] leading-relaxed text-slate-800 max-w-4xl">
              {response.answer}
            </p>

            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Practical Actions
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                {response.recommended_actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="font-mono tabular-nums">
                <span className="font-semibold text-slate-700">Cited metrics: </span>
                {response.cited_metrics.join(' · ')}
              </div>
              <span>{response.mode}</span>
            </div>

            <p className="text-xs text-slate-500">{response.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
}
