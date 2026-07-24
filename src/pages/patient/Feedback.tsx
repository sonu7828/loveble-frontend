import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Star, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Feedback = () => {
  const { token } = useParams();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [allowTestimonial, setAllowTestimonial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const submit = async () => {
    if (!rating) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-feedback", {
      body: { token, rating, comment, allowTestimonial },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Could not submit");
      return;
    }
    if (rating === 5 && data?.reviewUrl) {
      setRedirecting(true);
      window.location.replace(data.reviewUrl);
      return;
    }
    setDone(true);
  };



  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-xl">
        {redirecting ? (
          <div className="text-center py-16">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <h1 className="font-serif text-4xl">Thank you!</h1>
            <p className="text-muted-foreground mt-3">
              Taking you to Google to share your review…
            </p>
          </div>
        ) : done ? (


          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mb-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-serif text-4xl">Thank you.</h1>
            <p className="text-muted-foreground mt-3">
              Your feedback goes straight to our team — we read every word.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="font-serif text-4xl">How was your visit?</h1>
            <p className="text-muted-foreground mt-2">
              Your honest feedback helps us improve. This stays private with our team.
            </p>

            <div className="mt-10 space-y-8">
              <div>
                <label className="text-sm font-medium block mb-3" id="rating-label">Your rating</label>
                <div
                  className="flex gap-1.5"
                  role="radiogroup"
                  aria-labelledby="rating-label"
                  onMouseLeave={() => setHover(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setRating(n)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setRating(Math.min(5, (rating || 0) + 1));
                        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault();
                          setRating(Math.max(1, (rating || 1) - 1));
                        }
                      }}
                      className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`h-10 w-10 ${
                          (hover || rating) >= n
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="comment" className="text-sm font-medium block mb-2">
                  Tell us more <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="What did you love? What could we do better?"
                />
              </div>

              {rating >= 4 && (
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowTestimonial}
                    onChange={(e) => setAllowTestimonial(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="text-muted-foreground">
                    You can share my comment as a testimonial (first name only).
                  </span>
                </label>
              )}

              <Button
                onClick={submit}
                disabled={submitting || !rating}
                size="lg"
                className="w-full rounded-full"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send feedback"}
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Feedback;
