import { SUITABILITY_LABELS } from "@/lib/format";
import type { SkillLevel, Suitability, SuitabilityLevel } from "@/types/forecast";

const LEVEL_STYLES: Record<SuitabilityLevel, string> = {
  ideal: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  good: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/30 dark:text-cyan-300",
  marginal: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  unsuitable: "bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:text-slate-400",
};

const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function SuitabilityBadges({
  suitability,
  detailed = false,
}: {
  suitability: Record<SkillLevel, Suitability>;
  detailed?: boolean;
}) {
  const levels = Object.entries(suitability) as [SkillLevel, Suitability][];
  if (detailed) {
    return (
      <dl className="grid gap-3 sm:grid-cols-3">
        {levels.map(([skill, value]) => (
          <div key={skill} className="glass-subtle p-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{SKILL_LABELS[skill]}</dt>
            <dd className="mt-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${LEVEL_STYLES[value.level]}`}>
                {SUITABILITY_LABELS[value.level]}
              </span>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{value.reason}</p>
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skill suitability">
      {levels.map(([skill, value]) => (
        <li
          key={skill}
          title={value.reason}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${LEVEL_STYLES[value.level]}`}
        >
          {SKILL_LABELS[skill]}: {SUITABILITY_LABELS[value.level]}
        </li>
      ))}
    </ul>
  );
}
