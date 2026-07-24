import { useEffect } from "react";

/**
 * Tiny client-side per-route head updater. JS-executing crawlers (Googlebot)
 * see these; social-preview crawlers fall back to the static `index.html`.
 */
export function usePageMeta(opts: {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: "website" | "article";
}) {
  useEffect(() => {
    if (opts.title) document.title = opts.title;

    const setMeta = (selector: string, attr: "content" | "href", value: string, create?: () => HTMLElement) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (!el && create) { el = create(); document.head.appendChild(el); }
      if (el) el.setAttribute(attr, value);
    };

    if (opts.description) {
      setMeta('meta[name="description"]', "content", opts.description, () => {
        const m = document.createElement("meta"); m.setAttribute("name", "description"); return m;
      });
      setMeta('meta[property="og:description"]', "content", opts.description, () => {
        const m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m;
      });
      setMeta('meta[name="twitter:description"]', "content", opts.description, () => {
        const m = document.createElement("meta"); m.setAttribute("name", "twitter:description"); return m;
      });
    }

    if (opts.title) {
      setMeta('meta[property="og:title"]', "content", opts.title, () => {
        const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m;
      });
      setMeta('meta[name="twitter:title"]', "content", opts.title, () => {
        const m = document.createElement("meta"); m.setAttribute("name", "twitter:title"); return m;
      });
    }

    if (opts.canonical) {
      setMeta('link[rel="canonical"]', "href", opts.canonical, () => {
        const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l;
      });
      setMeta('meta[property="og:url"]', "content", opts.canonical, () => {
        const m = document.createElement("meta"); m.setAttribute("property", "og:url"); return m;
      });
    }

    if (opts.ogType) {
      setMeta('meta[property="og:type"]', "content", opts.ogType, () => {
        const m = document.createElement("meta"); m.setAttribute("property", "og:type"); return m;
      });
    }
  }, [opts.title, opts.description, opts.canonical, opts.ogType]);
}
