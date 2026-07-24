// Client-facing PROM (FACE-Q / Skindex-16) survey card.
// Shows surveys whose default_offset_days has elapsed since the client's most
// recent signed appointment, and that haven't been completed yet.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ClipboardList, Check, Sparkles } from "lucide-react";
import { differenceInDays } from "date-fns";
import { score, type PromInstrument } from "@/lib/promScoring";
import { toast } from "sonner";

type Appt = {
  id: string;
  start_at: string;
  service_name: string | null;
  category_hint: string | null;
};

type DueSurvey = {
  instrument: PromInstrument;
  appointment: Appt;
  timepoint: string;
};

export function PromSurveysCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [due, setDue] = useState<DueSurvey[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const email = user.email!.toLowerCase();
      const [{ data: instruments }, { data: notes }, { data: responses }] = await Promise.all([
        supabase.from("prom_instruments").select("*").eq("is_active", true),
        supabase
          .from("clinical_notes")
          .select("appointment_id, category, service_name, signed_at, status")
          .eq("client_email", email)
          .in("status", ["signed", "cosigned", "locked"])
          .order("signed_at", { ascending: false })
          .limit(20),
        supabase
          .from("prom_responses")
          .select("instrument_key, appointment_id, timepoint")
          .eq("client_email", email),
      ]);
      if (cancel) return;

      const completed = new Set(
        (responses ?? []).map((r: any) => `${r.instrument_key}::${r.appointment_id}::${r.timepoint}`),
      );

      const items: DueSurvey[] = [];
      for (const inst of ((instruments ?? []) as unknown as PromInstrument[])) {
        const offset = inst.default_offset_days ?? 28;
        // Find most recent signed note that (a) matches category, (b) is past offset, (c) not done yet
        const match = (notes ?? []).find((n: any) => {
          if (!n.signed_at || !n.appointment_id) return false;
          const days = differenceInDays(new Date(), new Date(n.signed_at));
          if (days < offset) return false;
          if (inst.category === "injectable" && !["neurotoxin", "filler"].includes(n.category)) return false;
          if (inst.category === "skin" && n.category !== "energy") return false;
          const tp = offset >= 70 ? "12wk" : offset >= 21 ? "4wk" : "adhoc";
          const k = `${inst.key}::${n.appointment_id}::${tp}`;
          return !completed.has(k);
        });
        if (match) {
          const tp = offset >= 70 ? "12wk" : offset >= 21 ? "4wk" : "adhoc";
          items.push({
            instrument: inst,
            appointment: {
              id: match.appointment_id,
              start_at: match.signed_at,
              service_name: match.service_name,
              category_hint: match.category,
            },
            timepoint: tp,
          });
        }
      }
      setDue(items);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.email]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for follow-up surveys…
      </div>
    );
  }
  if (due.length === 0) return null;

  const active = due.find((d) => `${d.instrument.key}::${d.appointment.id}` === activeKey);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg">How are you feeling about your results?</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        These short, validated surveys help us measure how treatments are actually working — and improve care for everyone.
        Optional, private, and takes under a minute.
      </p>

      {!active && (
        <div className="space-y-2">
          {due.map((d) => (
            <button
              key={`${d.instrument.key}::${d.appointment.id}`}
              onClick={() => setActiveKey(`${d.instrument.key}::${d.appointment.id}`)}
              className="w-full text-left rounded-xl border border-border bg-background hover:border-primary/40 transition p-3 flex items-center gap-3"
            >
              <ClipboardList className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{d.instrument.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {d.appointment.service_name ?? "Recent visit"} · {d.timepoint === "12wk" ? "12-week" : "4-week"} follow-up
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{d.instrument.questions.length} Qs</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <SurveyForm
          survey={active}
          onCancel={() => setActiveKey(null)}
          onSubmitted={() => {
            setDue((prev) => prev.filter((x) => `${x.instrument.key}::${x.appointment.id}` !== activeKey));
            setActiveKey(null);
          }}
        />
      )}
    </div>
  );
}

function SurveyForm({
  survey,
  onCancel,
  onSubmitted,
}: {
  survey: DueSurvey;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = useMemo(
    () => survey.instrument.questions.every((q) => typeof answers[q.id] === "number"),
    [answers, survey.instrument.questions],
  );

  const submit = async () => {
    if (!user?.email) return;
    setSubmitting(true);
    const s = score(survey.instrument, answers);
    const { error } = await supabase.from("prom_responses").insert({
      instrument_id: survey.instrument.id,
      instrument_key: survey.instrument.key,
      client_email: user.email.toLowerCase(),
      appointment_id: survey.appointment.id,
      timepoint: survey.timepoint,
      answers,
      raw_score: s.raw,
      normalized_score: s.normalized,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thank you — your response has been recorded.");
    onSubmitted();
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">{survey.instrument.name}</div>
      {survey.instrument.description && (
        <div className="text-xs text-muted-foreground -mt-3">{survey.instrument.description}</div>
      )}
      <div className="space-y-4">
        {survey.instrument.questions.map((q) => {
          const [lo, hi] = q.scale.split("-").map((n) => parseInt(n, 10));
          const opts: number[] = [];
          for (let i = lo; i <= hi; i++) opts.push(i);
          return (
            <div key={q.id} className="rounded-xl border border-border bg-background p-3">
              <div className="text-sm">{q.text}</div>
              <div className="mt-2 flex gap-1 flex-wrap">
                {opts.map((v, idx) => (
                  <button
                    key={v}
                    onClick={() => setAnswers({ ...answers, [q.id]: v })}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                      answers[q.id] === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {q.labels?.[idx] ?? v}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-xs px-3 py-2 rounded-md border border-border hover:bg-secondary">
          Cancel
        </button>
        <button
          disabled={!allAnswered || submitting}
          onClick={submit}
          className="text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Submit
        </button>
      </div>
    </div>
  );
}
