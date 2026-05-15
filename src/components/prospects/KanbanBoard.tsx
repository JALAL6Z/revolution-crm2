import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Phone, Mail, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type KanbanStatus =
  | "a_contacter" | "contacte" | "rdv_pris" | "proposition" | "client" | "perdu";

interface ColMeta { label: string; accent: string; dot: string }

const COLS: { key: KanbanStatus; meta: ColMeta }[] = [
  { key: "a_contacter", meta: { label: "À contacter", accent: "border-muted-foreground/30", dot: "bg-muted-foreground" } },
  { key: "contacte", meta: { label: "Contacté", accent: "border-blue-500/40", dot: "bg-blue-500" } },
  { key: "rdv_pris", meta: { label: "RDV pris", accent: "border-warning/40", dot: "bg-warning" } },
  { key: "proposition", meta: { label: "Proposition", accent: "border-primary/40", dot: "bg-primary" } },
  { key: "client", meta: { label: "Client 🎉", accent: "border-success/40", dot: "bg-success" } },
  { key: "perdu", meta: { label: "Perdu", accent: "border-destructive/40", dot: "bg-destructive" } },
];

interface Prospect {
  id: string; name: string; status: string; sector?: string | null;
  city?: string | null; source?: string | null; phone?: string | null;
  email?: string | null; analysis_score?: number | null;
}

interface Props {
  prospects: Prospect[];
  onCardClick: (id: string) => void;
  onStatusChange: (id: string, status: KanbanStatus) => void;
  sourceLabels: Record<string, string>;
}

export function KanbanBoard({ prospects, onCardClick, onStatusChange, sourceLabels }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map: Record<string, Prospect[]> = {};
    COLS.forEach((c) => (map[c.key] = []));
    prospects.forEach((p) => {
      if (map[p.status]) map[p.status].push(p);
    });
    return map;
  }, [prospects]);

  const activeProspect = activeId ? prospects.find((p) => p.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    const draggedId = String(e.active.id);
    if (!overId) return;
    const overStr = String(overId);
    const targetCol = COLS.find((c) => c.key === overStr)?.key
      ?? prospects.find((p) => p.id === overStr)?.status as KanbanStatus | undefined;
    if (!targetCol) return;
    const current = prospects.find((p) => p.id === draggedId);
    if (!current || current.status === targetCol) return;
    onStatusChange(draggedId, targetCol);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {COLS.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            items={grouped[col.key] || []}
            sourceLabels={sourceLabels}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeProspect && (
          <div className="rotate-2">
            <ProspectCard prospect={activeProspect} sourceLabels={sourceLabels} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  col, items, sourceLabels, onCardClick,
}: {
  col: { key: KanbanStatus; meta: ColMeta };
  items: Prospect[];
  sourceLabels: Record<string, string>;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[500px] flex-col rounded-xl border bg-muted/20 p-3 transition-all duration-200",
        col.meta.accent,
        isOver && "bg-primary/5 ring-2 ring-primary/40 scale-[1.01]",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", col.meta.dot)} />
          <span className="text-sm font-semibold">{col.meta.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <DraggableCard key={p.id} prospect={p} sourceLabels={sourceLabels} onClick={() => onCardClick(p.id)} />
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground/60">
            Glissez ici
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  prospect, sourceLabels, onClick,
}: { prospect: Prospect; sourceLabels: Record<string, string>; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospect.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      onClick={onClick}
    >
      <ProspectCard prospect={prospect} sourceLabels={sourceLabels} dragHandle={{ ...listeners, ...attributes }} />
    </div>
  );
}

function ProspectCard({
  prospect, sourceLabels, dragHandle, dragging,
}: {
  prospect: Prospect;
  sourceLabels: Record<string, string>;
  dragHandle?: any;
  dragging?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer p-3 transition-all hover:border-primary/40 hover:shadow-elegant",
        dragging && "shadow-glow border-primary/60",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...(dragHandle || {})}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 cursor-grab opacity-30 transition-opacity hover:opacity-100 active:cursor-grabbing"
          aria-label="Déplacer"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium">{prospect.name}</p>
            {prospect.analysis_score != null && (
              <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                <Sparkles className="h-2.5 w-2.5 text-primary" />{prospect.analysis_score}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[prospect.sector, prospect.city].filter(Boolean).join(" • ") || "—"}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">
              {sourceLabels[prospect.source || "manual"] || prospect.source}
            </Badge>
            <div className="flex gap-1.5 text-muted-foreground">
              {prospect.phone && <Phone className="h-3 w-3" />}
              {prospect.email && <Mail className="h-3 w-3" />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
