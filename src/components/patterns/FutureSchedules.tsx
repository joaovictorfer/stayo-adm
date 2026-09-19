import * as React from "react";
import { cn } from "@/lib/utils";

interface FutureSchedulesProps {
  className?: string;
}

type ScheduleItem = {
  type: "divider" | "hour";
  id: string;
  text?: string;
  time?: string;
  isNow?: boolean;
  status?: string;
  color?: string;
};

export function FutureSchedules({ className }: FutureSchedulesProps) {
  const [items, setItems] = React.useState<ScheduleItem[]>([]);

  React.useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const newItems: ScheduleItem[] = [];
    
    for (let d = 0; d <= 2; d++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + d);
      
      const dayNameShort = targetDate.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const dayNameShortCap = dayNameShort.charAt(0).toUpperCase() + dayNameShort.slice(1);
      
      const dayNameLong = targetDate.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
      const dayNameLongCap = dayNameLong.charAt(0).toUpperCase() + dayNameLong.slice(1);
      
      let headerText = "";
      if (d === 0) headerText = `Hoje · ${dayNameShortCap}`;
      else if (d === 1) headerText = `Amanhã · ${dayNameShortCap}`;
      else headerText = dayNameLongCap;
      
      newItems.push({ type: "divider", text: headerText, id: `div-${d}` });
      
      const startHour = d === 0 ? currentHour : 0;
      
      for (let h = startHour; h <= 23; h++) {
        const isNow = d === 0 && h === currentHour;
        let status = "Moderado";
        let color = "bg-amber-400";
        
        if (h >= 18 && h <= 21) {
          status = "Mais cheio";
          color = "bg-orange-500";
        } else if (h >= 9 && h <= 17) {
          status = "Moderado";
          color = "bg-amber-400";
        } else {
          status = "Calmo";
          color = "bg-emerald-500";
        }
        
        newItems.push({
          type: "hour",
          id: `h-${d}-${h}`,
          time: `${h.toString().padStart(2, "0")}:00`,
          isNow,
          status,
          color,
        });
      }
    }
    
    setItems(newItems);
  }, []);

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-[22px] font-semibold text-foreground px-4 sm:px-0">Horários à frente</h2>
      
      <div 
        className="flex w-full overflow-x-auto snap-x snap-mandatory pb-4 px-4 sm:px-0 gap-2.5 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}} />
        
        {items.map((item) => {
          if (item.type === "divider") {
            return (
              <div 
                key={item.id} 
                className="snap-start shrink-0 flex items-center justify-center px-1"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 bg-muted/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                  {item.text}
                </span>
              </div>
            );
          }
          
          if (item.type === "hour") {
            if (item.isNow) {
              return (
                <div 
                  key={item.id} 
                  className="snap-start shrink-0 flex flex-col justify-center items-center rounded-xl bg-blue-950 text-white w-[88px] h-[72px] shadow-sm relative overflow-hidden ring-1 ring-blue-900/10 gap-0.5"
                >
                  <div className="absolute top-0 w-full bg-blue-600/90 py-[3px] flex justify-center">
                    <span className="text-[9px] font-bold tracking-wider text-white/95">AGORA</span>
                  </div>
                  <span className="mt-3.5 text-[20px] font-bold tracking-tight">{item.time}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", item.color)}></span>
                    <span className="text-[11px] font-medium text-blue-100">{item.status}</span>
                  </div>
                </div>
              );
            }
            
            return (
              <div 
                key={item.id} 
                className="snap-start shrink-0 flex flex-col justify-center items-center rounded-xl bg-white border border-border/60 text-foreground w-[76px] sm:w-[82px] h-[72px] shadow-sm gap-0.5"
              >
                <span className="text-[20px] font-semibold tracking-tight">{item.time}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full", item.color)}></span>
                  <span className="text-[11px] text-muted-foreground font-medium">{item.status}</span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}
