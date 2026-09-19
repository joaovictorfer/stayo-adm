import { cn } from "@/lib/utils";

interface LiveLaundryStatusProps {
  className?: string;
  freeMachines?: number;
  statusLabel?: string;
  recommendation?: string;
}

export function LiveLaundryStatus({ 
  className,
  freeMachines = 6,
  statusLabel = "Bom momento para vir.",
  recommendation = "Costuma ficar calmo até as 18h"
}: LiveLaundryStatusProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="text-lg font-semibold text-foreground">Agora</h2>
      
      <div className="flex w-full items-stretch overflow-hidden rounded-xl bg-blue-50 border border-blue-100 shadow-sm max-h-[105px]">
        <div className="flex shrink-0 items-center justify-center bg-blue-500/5 px-4 py-3 sm:px-5">
          <span className="text-5xl font-bold tracking-tighter text-blue-950">
            {freeMachines}
          </span>
          <span className="ml-2 max-w-[4.5rem] text-xs font-semibold leading-tight text-blue-900/80">
            máquinas livres
          </span>
        </div>

        <div className="flex flex-1 flex-col items-start justify-center px-4 py-2 border-l border-white/50">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 shadow-sm border border-blue-100/50">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-emerald-700">
              AO VIVO
            </span>
          </div>
          
          <p className="mt-1 text-sm font-medium leading-tight text-blue-950 line-clamp-1">
            {statusLabel}
          </p>
          
          {recommendation && (
            <p className="mt-0.5 text-[11px] text-blue-800/70 line-clamp-1">
              {recommendation}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
