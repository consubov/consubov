import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, Plus, Save, X, Undo2, Palette, GripVertical, Route, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeLabelLayout, PastoPin } from "@/components/mapa/MapaViewer";
import type { PastoMapaData } from "@/hooks/useMapaData";

interface PastoOption {
  id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  label_offset_x: number | null;
  label_offset_y: number | null;
  label_rotation: number | null;
}

interface DrawnPolygon {
  id?: string;
  pasto_id: string;
  coordenadas: number[][];
  cor: string;
  label_offset_x?: number;
  label_offset_y?: number;
  label_rotation?: number;
  pasto_nome?: string;
  num_animais?: number;
  peso_medio_kg?: number | null;
  categoria?: string | null;
  sexo?: string | null;
  status_consumo?: string | null;
}

interface DrawnLine {
  id?: string;
  coordenadas: number[][];
  cor: string;
  tipo: string;
  rotulo: string;
}

interface DrawnElement {
  id?: string;
  tipo: string;
  emoji: string;
  posicao_x: number;
  posicao_y: number;
  rotulo: string;
}

interface Props {
  fazendaId: string;
  retiroId: string;
  mapaId?: string;
  imagemUrl?: string;
  existingPolygons?: DrawnPolygon[];
  existingLines?: DrawnLine[];
  existingElements?: DrawnElement[];
  onSaved: () => void;
}

const LINE_COLORS = [
  { value: "#16a34a", label: "Verde (pasto)", emoji: "🟩" },
  { value: "#92400e", label: "Marrom (estrada)", emoji: "🟫" },
  { value: "#2563eb", label: "Azul (água)", emoji: "🟦" },
  { value: "#eab308", label: "Amarelo (divisão)", emoji: "🟨" },
  { value: "#dc2626", label: "Vermelho (alerta)", emoji: "🟥" },
];

const ELEMENT_PRESETS = [
  { tipo: "casa", emoji: "🏠", label: "Casa" },
  { tipo: "curral", emoji: "🐂", label: "Curral" },
  { tipo: "cocho", emoji: "🪣", label: "Cocho" },
  { tipo: "agua", emoji: "💧", label: "Água" },
  { tipo: "porteira", emoji: "🚪", label: "Porteira" },
];

type EditorMode = "idle" | "drawPolygon" | "drawLine" | "placeElement";

export default function MapaEditor({
  fazendaId, retiroId, mapaId, imagemUrl, existingPolygons, existingLines, existingElements, onSaved,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imagemUrl || "");
  const [pastos, setPastos] = useState<PastoOption[]>([]);
  const [polygons, setPolygons] = useState<DrawnPolygon[]>(
    (existingPolygons || []).map((p) => ({ ...p, cor: p.cor || "#16a34a" }))
  );
  const [lines, setLines] = useState<DrawnLine[]>(existingLines || []);
  const [elements, setElements] = useState<DrawnElement[]>(existingElements || []);

  const [mode, setMode] = useState<EditorMode>("idle");
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [selectedPastoId, setSelectedPastoId] = useState("");
  const [selectedColor, setSelectedColor] = useState("#16a34a");
  const [lineType, setLineType] = useState("estrada");
  const [lineLabel, setLineLabel] = useState("");
  const [placingElement, setPlacingElement] = useState<{ tipo: string; emoji: string } | null>(null);
  const [customEmoji, setCustomEmoji] = useState("📍");
  const [elementLabel, setElementLabel] = useState("");

  const [saving, setSaving] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Vertex editing state
  const [editingPolygonIndex, setEditingPolygonIndex] = useState<number | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ target: "poly" | "line"; idx: number; vertIdx: number } | null>(null);
  const [draggingElement, setDraggingElement] = useState<number | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<{
    idx: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    async function loadPastos() {
      const { data } = await supabase
        .from("pastos")
        .select("id, nome, num_animais, peso_medio_kg, categoria, sexo, label_offset_x, label_offset_y, label_rotation")
        .eq("ativo", true)
        .eq("retiro_id", retiroId)
        .order("nome");
      setPastos(data ?? []);
    }
    loadPastos();
  }, [retiroId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${fazendaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("mapas").upload(path, file);
    if (error) { toast.error("Erro ao enviar imagem."); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("mapas").getPublicUrl(path);
    setCurrentImageUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImgSize({ width: img.clientWidth, height: img.clientHeight });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const img = containerRef.current?.querySelector("img");
      if (img) setImgSize({ width: img.clientWidth, height: img.clientHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scaleX = imgSize.width / naturalSize.width;
  const scaleY = imgSize.height / naturalSize.height;

  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: Math.round((clientX - rect.left) / scaleX), y: Math.round((clientY - rect.top) / scaleY) };
  }, [scaleX, scaleY]);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingVertex || draggingElement !== null) return;
    const { x, y } = getSvgCoords(e.clientX, e.clientY);

    if (mode === "drawPolygon" || mode === "drawLine") {
      setCurrentPoints((prev) => [...prev, [x, y]]);
      return;
    }

    if (mode === "placeElement" && placingElement) {
      setElements((prev) => [...prev, {
        tipo: placingElement.tipo,
        emoji: placingElement.emoji,
        posicao_x: x,
        posicao_y: y,
        rotulo: elementLabel,
      }]);
      toast.success("Elemento adicionado!");
      setMode("idle");
      setPlacingElement(null);
      setElementLabel("");
      return;
    }
  };

  const resetMode = () => {
    setMode("idle");
    setCurrentPoints([]);
    setSelectedPastoId("");
    setPlacingElement(null);
    setElementLabel("");
    setEditingPolygonIndex(null);
    setEditingLineIndex(null);
  };

  // --- Polygon functions ---
  const finishPolygon = () => {
    if (currentPoints.length < 3) { toast.error("Desenhe pelo menos 3 pontos."); return; }
    if (!selectedPastoId) { toast.error("Selecione um pasto para vincular."); return; }
    if (polygons.some((p) => p.pasto_id === selectedPastoId)) { toast.error("Este pasto já está vinculado."); return; }
    const selectedPasto = pastos.find((p) => p.id === selectedPastoId);
    setPolygons((prev) => [...prev, {
      pasto_id: selectedPastoId,
      coordenadas: currentPoints,
      cor: selectedColor,
      label_offset_x: Number(selectedPasto?.label_offset_x) || 0,
      label_offset_y: Number(selectedPasto?.label_offset_y) || 0,
      label_rotation: Number(selectedPasto?.label_rotation) || 0,
      pasto_nome: selectedPasto?.nome || "Pasto",
      num_animais: selectedPasto?.num_animais || 0,
      peso_medio_kg: selectedPasto?.peso_medio_kg ?? null,
      categoria: selectedPasto?.categoria ?? null,
      sexo: selectedPasto?.sexo ?? null,
      status_consumo: null,
    }]);
    setCurrentPoints([]);
    setSelectedPastoId("");
    setMode("idle");
    toast.success("Pasto adicionado!");
  };

  // --- Line functions ---
  const finishLine = () => {
    if (currentPoints.length < 2) { toast.error("Desenhe pelo menos 2 pontos."); return; }
    setLines((prev) => [...prev, { coordenadas: currentPoints, cor: selectedColor, tipo: lineType, rotulo: lineLabel }]);
    setCurrentPoints([]);
    setLineLabel("");
    setMode("idle");
    toast.success("Linha adicionada!");
  };

  // --- Remove ---
  const removePolygon = (i: number) => { setPolygons((prev) => prev.filter((_, idx) => idx !== i)); if (editingPolygonIndex === i) setEditingPolygonIndex(null); };
  const removeLine = (i: number) => { setLines((prev) => prev.filter((_, idx) => idx !== i)); if (editingLineIndex === i) setEditingLineIndex(null); };
  const removeElement = (i: number) => { setElements((prev) => prev.filter((_, idx) => idx !== i)); };

  // --- Vertex drag ---
  useEffect(() => {
    if (!draggingVertex) return;
    const handleMove = (clientX: number, clientY: number) => {
      const { x, y } = getSvgCoords(clientX, clientY);
      if (draggingVertex.target === "poly") {
        setPolygons((prev) => prev.map((p, pi) => {
          if (pi !== draggingVertex.idx) return p;
          const c = [...p.coordenadas]; c[draggingVertex.vertIdx] = [x, y]; return { ...p, coordenadas: c };
        }));
      } else {
        setLines((prev) => prev.map((l, li) => {
          if (li !== draggingVertex.idx) return l;
          const c = [...l.coordenadas]; c[draggingVertex.vertIdx] = [x, y]; return { ...l, coordenadas: c };
        }));
      }
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => setDraggingVertex(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onUp); };
  }, [draggingVertex, getSvgCoords]);

  // --- Element drag ---
  useEffect(() => {
    if (draggingElement === null) return;
    const handleMove = (clientX: number, clientY: number) => {
      const { x, y } = getSvgCoords(clientX, clientY);
      setElements((prev) => prev.map((el, i) => i === draggingElement ? { ...el, posicao_x: x, posicao_y: y } : el));
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => setDraggingElement(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onUp); };
  }, [draggingElement, getSvgCoords]);

  // --- Pasture label drag ---
  useEffect(() => {
    if (!draggingLabel) return;
    const handleMove = (clientX: number, clientY: number) => {
      const { x, y } = getSvgCoords(clientX, clientY);
      setPolygons((prev) => prev.map((polygon, index) => index === draggingLabel.idx ? {
        ...polygon,
        label_offset_x: draggingLabel.offsetX + x - draggingLabel.startX,
        label_offset_y: draggingLabel.offsetY + y - draggingLabel.startY,
      } : polygon));
    };
    const onMouseMove = (event: MouseEvent) => handleMove(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) handleMove(touch.clientX, touch.clientY);
    };
    const onUp = () => setDraggingLabel(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingLabel, getSvgCoords]);

  // Edge click to add point
  const handleEdgeClick = (e: React.MouseEvent, target: "poly" | "line", idx: number, edgeIdx: number) => {
    e.stopPropagation();
    const { x, y } = getSvgCoords(e.clientX, e.clientY);
    if (target === "poly") {
      setPolygons((prev) => prev.map((p, pi) => { if (pi !== idx) return p; const c = [...p.coordenadas]; c.splice(edgeIdx + 1, 0, [x, y]); return { ...p, coordenadas: c }; }));
    } else {
      setLines((prev) => prev.map((l, li) => { if (li !== idx) return l; const c = [...l.coordenadas]; c.splice(edgeIdx + 1, 0, [x, y]); return { ...l, coordenadas: c }; }));
    }
  };

  const handleVertexDelete = (e: React.MouseEvent, target: "poly" | "line", idx: number, vertIdx: number) => {
    e.stopPropagation(); e.preventDefault();
    const minPts = target === "poly" ? 3 : 2;
    const arr = target === "poly" ? polygons[idx].coordenadas : lines[idx].coordenadas;
    if (arr.length <= minPts) { toast.error(`Mínimo ${minPts} pontos.`); return; }
    if (target === "poly") {
      setPolygons((prev) => prev.map((p, pi) => pi !== idx ? p : { ...p, coordenadas: p.coordenadas.filter((_, vi) => vi !== vertIdx) }));
    } else {
      setLines((prev) => prev.map((l, li) => li !== idx ? l : { ...l, coordenadas: l.coordenadas.filter((_, vi) => vi !== vertIdx) }));
    }
  };

  const changeColor = (target: "poly" | "line", idx: number, color: string) => {
    if (target === "poly") setPolygons((prev) => prev.map((p, pi) => pi === idx ? { ...p, cor: color } : p));
    else setLines((prev) => prev.map((l, li) => li === idx ? { ...l, cor: color } : l));
  };

  // --- Save ---
  const handleSave = async () => {
    if (!currentImageUrl) { toast.error("Envie uma imagem do mapa."); return; }
    setSaving(true);
    let currentMapaId = mapaId;
    if (!currentMapaId) {
      const { data, error } = await supabase.from("mapas").insert({ fazenda_id: fazendaId, retiro_id: retiroId, imagem_url: currentImageUrl }).select("id").single();
      if (error || !data) { toast.error("Erro ao criar mapa."); setSaving(false); return; }
      currentMapaId = data.id;
    } else {
      await supabase.from("mapas").update({ imagem_url: currentImageUrl }).eq("id", currentMapaId);
    }

    // Delete old data and re-insert
    await Promise.all([
      supabase.from("pastos_mapa").delete().eq("mapa_id", currentMapaId),
      supabase.from("linhas_mapa").delete().eq("mapa_id", currentMapaId),
      supabase.from("elementos_mapa").delete().eq("mapa_id", currentMapaId),
    ]);

    const insertOps = [];
    if (polygons.length > 0) {
      insertOps.push(supabase.from("pastos_mapa").insert(polygons.map((p) => ({
        mapa_id: currentMapaId!, pasto_id: p.pasto_id, coordenadas: p.coordenadas, cor: p.cor,
      }))));
    }
    if (lines.length > 0) {
      insertOps.push(supabase.from("linhas_mapa").insert(lines.map((l) => ({
        mapa_id: currentMapaId!, coordenadas: l.coordenadas, cor: l.cor, tipo: l.tipo, rotulo: l.rotulo || null,
      }))));
    }
    if (elements.length > 0) {
      insertOps.push(supabase.from("elementos_mapa").insert(elements.map((el) => ({
        mapa_id: currentMapaId!, tipo: el.tipo, emoji: el.emoji, posicao_x: el.posicao_x, posicao_y: el.posicao_y, rotulo: el.rotulo || null,
      }))));
    }

    const results = await Promise.all(insertOps);
    if (results.some((r) => r.error)) {
      toast.error("Erro ao salvar dados do mapa.");
      setSaving(false);
      return;
    }

    const labelResults = await Promise.all(polygons.map((polygon) => supabase
      .from("pastos")
      .update({
        label_offset_x: polygon.label_offset_x || 0,
        label_offset_y: polygon.label_offset_y || 0,
        label_rotation: polygon.label_rotation || 0,
      })
      .eq("id", polygon.pasto_id)));
    if (labelResults.some((result) => result.error)) {
      toast.error("Mapa salvo, mas não foi possível salvar a posição de alguns rótulos.");
      setSaving(false);
      return;
    }

    setSaving(false);
    toast.success("Mapa salvo com sucesso!");
    onSaved();
  };

  const toPoints = (coords: number[][]) => coords.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ");

  const usedPastoIds = new Set(polygons.map((p) => p.pasto_id));
  const availablePastos = pastos.filter((p) => !usedPastoIds.has(p.id));

  const editingTarget = editingPolygonIndex !== null ? "poly" : editingLineIndex !== null ? "line" : null;
  const editingIdx = editingPolygonIndex ?? editingLineIndex ?? -1;

  const renderVertexHandles = (coords: number[][], target: "poly" | "line", idx: number, color: string) => (
    <>
      {coords.map(([x1, y1], i) => {
        const nextIdx = target === "poly" ? (i + 1) % coords.length : i + 1;
        if (nextIdx >= coords.length) return null;
        const [x2, y2] = coords[nextIdx];
        return (
          <line key={`edge-${target}-${idx}-${i}`} x1={x1 * scaleX} y1={y1 * scaleY} x2={x2 * scaleX} y2={y2 * scaleY}
            stroke="transparent" strokeWidth={12} className="cursor-cell"
            onClick={(e) => handleEdgeClick(e, target, idx, i)} />
        );
      })}
      {coords.map(([x, y], vertIdx) => (
        <circle key={`v-${target}-${idx}-${vertIdx}`} cx={x * scaleX} cy={y * scaleY} r={6}
          fill="white" stroke={color} strokeWidth={2} className="cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingVertex({ target, idx, vertIdx }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDraggingVertex({ target, idx, vertIdx }); }}
          onContextMenu={(e) => handleVertexDelete(e, target, idx, vertIdx)}
          onDoubleClick={(e) => handleVertexDelete(e, target, idx, vertIdx)} />
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      {!currentImageUrl && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Upload do Mapa</CardTitle></CardHeader>
          <CardContent>
            <Label htmlFor="mapa-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                {uploading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /> : (
                  <><Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Clique para enviar PNG, JPG ou PDF</p></>
                )}
              </div>
            </Label>
            <Input id="mapa-upload" type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" className="hidden" onChange={handleImageUpload} />
          </CardContent>
        </Card>
      )}

      {currentImageUrl && (
        <>
          {/* SVG Canvas */}
          <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border bg-muted">
            <img src={currentImageUrl} alt="Mapa" className="w-full h-auto block" onLoad={handleImageLoad} draggable={false} />
            {imgSize.width > 0 && (
              <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                preserveAspectRatio="none" onClick={handleCanvasClick}
                style={{ cursor: mode !== "idle" ? "crosshair" : "default" }}>

                {/* Polygons */}
                {polygons.map((p, polyIdx) => {
                  const isEditing = editingPolygonIndex === polyIdx;
                  const option = pastos.find((candidate) => candidate.id === p.pasto_id);
                  const labelPasto: PastoMapaData = {
                    id: p.id || `editor-${polyIdx}`,
                    pasto_id: p.pasto_id,
                    coordenadas: p.coordenadas,
                    cor: p.cor,
                    pasto_nome: p.pasto_nome || option?.nome || "Pasto",
                    num_animais: p.num_animais ?? option?.num_animais ?? 0,
                    peso_medio_kg: p.peso_medio_kg ?? option?.peso_medio_kg ?? null,
                    categoria: p.categoria ?? option?.categoria ?? null,
                    sexo: p.sexo ?? option?.sexo ?? null,
                    consumo_medio: null,
                    status_consumo: p.status_consumo ?? null,
                    ultima_movimentacao: null,
                    ultima_salga: null,
                    data_fim_carencia: null,
                    label_offset_x: p.label_offset_x || 0,
                    label_offset_y: p.label_offset_y || 0,
                    label_rotation: p.label_rotation || 0,
                  };
                  const labelLayout = computeLabelLayout(labelPasto);
                  return (
                    <g key={`poly-${polyIdx}`}>
                      <polygon points={toPoints(p.coordenadas)}
                        fill={isEditing ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"}
                        stroke={p.cor} strokeWidth={isEditing ? 3 : 2}
                        className={mode === "idle" && !isEditing ? "cursor-pointer" : ""}
                        onClick={(e) => { if (mode === "idle") { e.stopPropagation(); setEditingLineIndex(null); setEditingPolygonIndex(isEditing ? null : polyIdx); } }} />
                      {isEditing && renderVertexHandles(p.coordenadas, "poly", polyIdx, p.cor)}
                      {labelLayout && (
                        <g transform={`scale(${scaleX} ${scaleY}) translate(${labelPasto.label_offset_x} ${labelPasto.label_offset_y}) rotate(${labelPasto.label_rotation} ${labelLayout.centerX} ${labelLayout.centerY})`}
                          className={isEditing ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}
                          onMouseDown={(event) => {
                            if (!isEditing) return;
                            event.stopPropagation();
                            event.preventDefault();
                            const point = getSvgCoords(event.clientX, event.clientY);
                            setDraggingLabel({ idx: polyIdx, startX: point.x, startY: point.y, offsetX: labelPasto.label_offset_x, offsetY: labelPasto.label_offset_y });
                          }}
                          onTouchStart={(event) => {
                            if (!isEditing) return;
                            event.stopPropagation();
                            const touch = event.touches[0];
                            if (!touch) return;
                            const point = getSvgCoords(touch.clientX, touch.clientY);
                            setDraggingLabel({ idx: polyIdx, startX: point.x, startY: point.y, offsetX: labelPasto.label_offset_x, offsetY: labelPasto.label_offset_y });
                          }}>
                          {isEditing && (
                            <rect x={labelLayout.centerX - 16} y={labelLayout.pinCenterY - 20} width={32} height={76}
                              fill="transparent" pointerEvents="all" />
                          )}
                          {(() => {
                            let labelY = labelLayout.pinCenterY + (labelPasto.num_animais > 0 ? 21 * labelLayout.pinScale : -labelLayout.lines.reduce((sum, line) => sum + line.fontSize * 1.08, 0) / 2);
                            return labelLayout.lines.map((line, lineIndex) => {
                              const y = labelY + line.fontSize;
                              labelY += line.fontSize * 1.08;
                              return (
                                <text key={`${p.pasto_id}-label-${lineIndex}`} x={labelLayout.centerX} y={y}
                                  textAnchor="middle" fill="hsl(0 0% 0%)" fontSize={line.fontSize} fontWeight={line.fontWeight}
                                  stroke="hsl(0 0% 100%)" strokeWidth={line.fontSize * 0.16} strokeLinejoin="round"
                                  style={{ userSelect: "none", paintOrder: "stroke" }}>
                                  {line.text}
                                </text>
                              );
                            });
                          })()}
                          {labelPasto.num_animais > 0 && (
                            <PastoPin pasto={labelPasto} centerX={labelLayout.centerX} centerY={labelLayout.pinCenterY} scale={labelLayout.pinScale} />
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Lines */}
                {lines.map((l, lineIdx) => {
                  const isEditing = editingLineIndex === lineIdx;
                  return (
                    <g key={`line-${lineIdx}`}>
                      <polyline points={toPoints(l.coordenadas)} fill="none" stroke={l.cor}
                        strokeWidth={isEditing ? 4 : 3} strokeLinecap="round" strokeLinejoin="round"
                        className={mode === "idle" && !isEditing ? "cursor-pointer" : ""}
                        onClick={(e) => { if (mode === "idle") { e.stopPropagation(); setEditingPolygonIndex(null); setEditingLineIndex(isEditing ? null : lineIdx); } }} />
                      {/* Wider invisible hit area */}
                      <polyline points={toPoints(l.coordenadas)} fill="none" stroke="transparent"
                        strokeWidth={14} className={mode === "idle" ? "cursor-pointer" : ""}
                        onClick={(e) => { if (mode === "idle") { e.stopPropagation(); setEditingPolygonIndex(null); setEditingLineIndex(isEditing ? null : lineIdx); } }} />
                      {isEditing && renderVertexHandles(l.coordenadas, "line", lineIdx, l.cor)}
                    </g>
                  );
                })}

                {/* Elements */}
                {elements.map((el, elIdx) => (
                  <g key={`el-${elIdx}`}>
                    <text x={el.posicao_x * scaleX} y={el.posicao_y * scaleY} fontSize={20}
                      textAnchor="middle" dominantBaseline="central" className="cursor-grab"
                      style={{ userSelect: "none" }}
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingElement(elIdx); }}
                      onTouchStart={(e) => { e.stopPropagation(); setDraggingElement(elIdx); }}>
                      {el.emoji}
                    </text>
                    {el.rotulo && (
                      <text x={el.posicao_x * scaleX} y={el.posicao_y * scaleY + 14} fontSize={8}
                        textAnchor="middle" fill="hsl(0 0% 20%)" fontWeight={600}
                        style={{ pointerEvents: "none", userSelect: "none" }}>
                        {el.rotulo}
                      </text>
                    )}
                  </g>
                ))}

                {/* Current drawing points */}
                {currentPoints.length > 0 && (
                  <>
                    <polyline points={currentPoints.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ")}
                      fill="none" stroke={selectedColor} strokeWidth={2} strokeDasharray="5,5" />
                    {currentPoints.map(([x, y], i) => (
                      <circle key={i} cx={x * scaleX} cy={y * scaleY} r={4} fill={selectedColor} />
                    ))}
                  </>
                )}

                {/* Placing element preview */}
                {mode === "placeElement" && placingElement && (
                  <text x={imgSize.width / 2} y={20} fontSize={12} textAnchor="middle" fill="hsl(0 0% 40%)"
                    style={{ pointerEvents: "none" }}>
                    Clique para posicionar {placingElement.emoji}
                  </text>
                )}
              </svg>
            )}
          </div>

          {/* Editing toolbar for selected polygon or line */}
          {editingTarget !== null && (
            <Card className="border-primary/40">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <GripVertical className="w-4 h-4" />
                    {editingTarget === "poly"
                      ? `Editando: ${pastos.find((p) => p.id === polygons[editingIdx]?.pasto_id)?.nome || "Pasto"}`
                      : `Editando linha: ${lines[editingIdx]?.rotulo || lines[editingIdx]?.tipo || "Linha"}`}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                      onClick={() => editingTarget === "poly" ? removePolygon(editingIdx) : removeLine(editingIdx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => { setEditingPolygonIndex(null); setEditingLineIndex(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Cor:</span>
                  {LINE_COLORS.map((c) => (
                    <button key={c.value}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        (editingTarget === "poly" ? polygons[editingIdx]?.cor : lines[editingIdx]?.cor) === c.value
                          ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }} title={c.label}
                      onClick={() => changeColor(editingTarget, editingIdx, c.value)} />
                  ))}
                </div>
                {editingTarget === "poly" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="label-rotation" className="text-xs whitespace-nowrap">Rotação do rótulo</Label>
                    <Input id="label-rotation" type="number" min={-180} max={180} step={1}
                      value={polygons[editingIdx]?.label_rotation || 0}
                      onChange={(event) => {
                        const rotation = Number(event.target.value);
                        setPolygons((prev) => prev.map((polygon, index) => index === editingIdx ? { ...polygon, label_rotation: Number.isFinite(rotation) ? rotation : 0 } : polygon));
                      }}
                      className="h-8 w-24" />
                    <span className="text-xs text-muted-foreground">graus</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {editingTarget === "poly" ? "Arraste o rótulo ou os pontos • Clique na borda para adicionar • Duplo-clique no ponto para excluir" : "Arraste os pontos • Clique na borda para adicionar • Duplo-clique no ponto para excluir"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Mode toolbars */}
          <div className="flex flex-wrap gap-2">
            {mode === "idle" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { resetMode(); setMode("drawPolygon"); }}
                  disabled={availablePastos.length === 0} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Desenhar Pasto
                </Button>
                <Button size="sm" variant="outline" onClick={() => { resetMode(); setSelectedColor("#92400e"); setMode("drawLine"); }} className="gap-1.5">
                  <Route className="w-4 h-4" /> Desenhar Linha
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <MapPin className="w-4 h-4" /> Inserir Elemento
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2">
                    {ELEMENT_PRESETS.map((ep) => (
                      <button key={ep.tipo}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted"
                        onClick={() => { resetMode(); setPlacingElement(ep); setMode("placeElement"); }}>
                        <span>{ep.emoji}</span> {ep.label}
                      </button>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <div className="flex items-center gap-2 px-2 py-1">
                        <Input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)}
                          className="w-12 h-7 text-center p-0" maxLength={4} />
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => { resetMode(); setPlacingElement({ tipo: "outro", emoji: customEmoji }); setMode("placeElement"); }}>
                          Outro
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : mode === "drawPolygon" ? (
              <>
                <div className="flex-1 min-w-[120px]">
                  <Select value={selectedPastoId} onValueChange={setSelectedPastoId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Vincular a pasto..." /></SelectTrigger>
                    <SelectContent>
                      {availablePastos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <ColorPickerButton color={selectedColor} onChange={setSelectedColor} />
                <Button size="sm" onClick={finishPolygon} disabled={currentPoints.length < 3} className="gap-1.5">
                  <Save className="w-4 h-4" /> Concluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCurrentPoints((p) => p.slice(0, -1))} disabled={currentPoints.length === 0}>
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={resetMode}><X className="w-4 h-4" /></Button>
              </>
            ) : mode === "drawLine" ? (
              <>
                <div className="flex-1 min-w-[100px]">
                  <Select value={lineType} onValueChange={setLineType}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estrada">🛣️ Estrada</SelectItem>
                      <SelectItem value="agua">💧 Água</SelectItem>
                      <SelectItem value="cerca">🪵 Cerca</SelectItem>
                      <SelectItem value="outro">📏 Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input value={lineLabel} onChange={(e) => setLineLabel(e.target.value)} placeholder="Rótulo (opcional)" className="h-9 w-28" />
                <ColorPickerButton color={selectedColor} onChange={setSelectedColor} />
                <Button size="sm" onClick={finishLine} disabled={currentPoints.length < 2} className="gap-1.5">
                  <Save className="w-4 h-4" /> Concluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCurrentPoints((p) => p.slice(0, -1))} disabled={currentPoints.length === 0}>
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={resetMode}><X className="w-4 h-4" /></Button>
              </>
            ) : mode === "placeElement" ? (
              <>
                <span className="text-sm flex items-center gap-1.5">
                  {placingElement?.emoji} Clique no mapa para posicionar
                </span>
                <Input value={elementLabel} onChange={(e) => setElementLabel(e.target.value)} placeholder="Rótulo (opcional)" className="h-9 w-28" />
                <Button size="sm" variant="ghost" onClick={resetMode}><X className="w-4 h-4" /> Cancelar</Button>
              </>
            ) : null}
          </div>

          {/* Lists */}
          {(polygons.length > 0 || lines.length > 0 || elements.length > 0) && (
            <Card>
              <CardContent className="px-4 py-3 space-y-2">
                {polygons.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Pastos</p>
                    {polygons.map((p, i) => {
                      const pasto = pastos.find((opt) => opt.id === p.pasto_id);
                      return (
                        <div key={`p-${i}`} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setEditingLineIndex(null); setEditingPolygonIndex(editingPolygonIndex === i ? null : i); }}>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.cor }} />
                            <span className={editingPolygonIndex === i ? "font-semibold text-primary" : ""}>{pasto?.nome || p.pasto_id}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePolygon(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {lines.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Linhas</p>
                    {lines.map((l, i) => (
                      <div key={`l-${i}`} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setEditingPolygonIndex(null); setEditingLineIndex(editingLineIndex === i ? null : i); }}>
                          <div className="w-3 h-1.5 rounded" style={{ backgroundColor: l.cor }} />
                          <span className={editingLineIndex === i ? "font-semibold text-primary" : ""}>{l.rotulo || l.tipo}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                {elements.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Elementos</p>
                    {elements.map((el, i) => (
                      <div key={`e-${i}`} className="flex items-center justify-between text-sm">
                        <span>{el.emoji} {el.rotulo || el.tipo}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeElement(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Mapa
          </Button>
        </>
      )}
    </div>
  );
}

function ColorPickerButton({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-9">
          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />
          <Palette className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        {LINE_COLORS.map((c) => (
          <button key={c.value}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted ${color === c.value ? "bg-muted font-medium" : ""}`}
            onClick={() => onChange(c.value)}>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }} />
            {c.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
