import React from "react";
import { Clock, Code2, Server } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  owner?: string;
  endpoints?: string[];
  isComingSoon?: boolean;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  owner,
  endpoints,
  isComingSoon,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
            {isComingSoon && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/30">
                <Clock className="h-3 w-3" />
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        {owner && (
          <div className="flex items-center gap-2 rounded-lg border border-utm-border bg-utm-card px-3 py-1.5 text-xs">
            <span className="text-slate-400">Assigned Module:</span>
            <span className="font-semibold text-brand-400">{owner}</span>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-utm-border bg-gradient-to-b from-utm-card to-utm-surface p-8 shadow-card">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20">
            <Code2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-white">Module Placeholder Ready</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            This module route is registered in the shared app shell. Follow the page
            convention to plug the implementation component directly into this route.
          </p>

          {endpoints && endpoints.length > 0 && (
            <div className="mt-6 w-full max-w-lg rounded-xl border border-utm-border bg-utm-bg/60 p-4 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Server className="h-3.5 w-3.5 text-brand-400" />
                Associated Backend API Routes:
              </div>
              <ul className="mt-2 space-y-1 font-mono text-xs text-brand-300">
                {endpoints.map((ep) => (
                  <li key={ep} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                    {ep}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
