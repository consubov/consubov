import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, Plus, Save, X, Undo2, Palette, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PastoOption {
  id: string;
  nome: string;
}

interface DrawnPolygon {
  id?: string;
  pasto_id: string;
  coordenadas: number[][];
  cor: string;
}

interface Props {
  fazendaId: string;
  mapaId?: string;
  imagemUrl?: string;
  existingPolygons?: DrawnPolygon[];
  onSaved: () => void;
}

const LINE_COLORS = [
  { value: "#16a34a", label: "Verde (pasto)", emoji: "🟩" },
  { value: "#92400e", label: "Marrom (estrada)", emoji: "🟫" },
  { value: "#2563eb", label: "Azul (água)", emoji: "🟦" },
  { value: "#eab308", label: "Amarelo (divisão)", emoji: "🟨" },
  { value: "#dc2626", label: "Vermelho (alerta)", emoji: "🟥" },
];

const SNAP_RADIUS = 8; // pixels for snapping to edge

export default function MapaEditor({ fazendaId, mapaId, imagemUrl, existingPolygons, onSaved }: Props) {
  const [uploading, setUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imagemUrl || "");
  const [pastos, setPastos] = useState<PastoOption[]>([]);
  const [polygons, setPolygons] = useState<DrawnPolygon[]>(
    (existingPolygons || []).map((p) => ({ ...p, cor: p.cor || "#16a34a" }))
  );
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [selectedPastoId, setSelectedPastoId] = useState("");
  const [selectedColor, setSelectedColor] = useState("#16a34a");
  const [saving, setSaving] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Vertex editing state
  const [editingPolygonIndex, setEditingPolygonIndex] = useState<number | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ polyIdx: number; vertIdx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function loadPastos() {
      const { data } = await supabase
        .from("pastos")
        .select("id, nome, retiro_id")
        .eq("ativo", true)
        .order("nome");
      if (!data) return;
      const { data: retiros } = await supabase
        .from("retiros")
        .select("id")
        .eq("fazenda_id", fazendaId)
        .eq("ativo", true);
      const retiroIds = new Set((retiros ?? []).map((r) => r.id));
      setPastos(data.filter((p) => retiroIds.has(p.retiro_id)));
    }
    loadPastos();
  }, [fazendaId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${fazendaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("mapas").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem.");
      setUploading(false);
      return;
    }
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

  const getSvgCoords = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) / scaleX),
      y: Math.round((e.clientY - rect.top) / scaleY),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingVertex) return;
    if (!drawing) return;
    const { x, y } = getSvgCoords(e);
    setCurrentPoints((prev) => [...prev, [x, y]]);
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) {
      toast.error("Desenhe pelo menos 3 pontos.");
      return;
    }
    if (!selectedPastoId) {
      toast.error("Selecione um pasto para vincular.");
      return;
    }
    if (polygons.some((p) => p.pasto_id === selectedPastoId)) {
      toast.error("Este pasto já está vinculado no mapa.");
      return;
    }
    setPolygons((prev) => [...prev, { pasto_id: selectedPastoId, coordenadas: currentPoints, cor: selectedColor }]);
    setCurrentPoints([]);
    setSelectedPastoId("");
    setDrawing(false);
    toast.success("Pasto adicionado ao mapa!");
  };

  const removePolygon = (index: number) => {
    setPolygons((prev) => prev.filter((_, i) => i !== index));
    if (editingPolygonIndex === index) setEditingPolygonIndex(null);
  };

  // Vertex drag handlers
  const handleVertexMouseDown = (e: React.MouseEvent, polyIdx: number, vertIdx: number) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVertex({ polyIdx, vertIdx });
  };

  useEffect(() => {
    if (!draggingVertex) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getSvgCoords(e);
      setPolygons((prev) =>
        prev.map((p, pi) => {
          if (pi !== draggingVertex.polyIdx) return p;
          const newCoords = [...p.coordenadas];
          newCoords[draggingVertex.vertIdx] = [x, y];
          return { ...p, coordenadas: newCoords };
        })
      );
    };

    const handleMouseUp = () => setDraggingVertex(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingVertex]);

  // Touch drag for mobile
  useEffect(() => {
    if (!draggingVertex) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const svg = svgRef.current;
      if (!svg || !touch) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.round((touch.clientX - rect.left) / scaleX);
      const y = Math.round((touch.clientY - rect.top) / scaleY);
      setPolygons((prev) =>
        prev.map((p, pi) => {
          if (pi !== draggingVertex.polyIdx) return p;
          const newCoords = [...p.coordenadas];
          newCoords[draggingVertex.vertIdx] = [x, y];
          return { ...p, coordenadas: newCoords };
        })
      );
    };

    const handleTouchEnd = () => setDraggingVertex(null);

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [draggingVertex, scaleX, scaleY]);

  // Add point on edge
  const handleEdgeClick = (e: React.MouseEvent, polyIdx: number, edgeIdx: number) => {
    e.stopPropagation();
    const { x, y } = getSvgCoords(e);
    setPolygons((prev) =>
      prev.map((p, pi) => {
        if (pi !== polyIdx) return p;
        const newCoords = [...p.coordenadas];
        newCoords.splice(edgeIdx + 1, 0, [x, y]);
        return { ...p, coordenadas: newCoords };
      })
    );
  };

  // Delete vertex
  const handleVertexDelete = (e: React.MouseEvent, polyIdx: number, vertIdx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const poly = polygons[polyIdx];
    if (poly.coordenadas.length <= 3) {
      toast.error("Mínimo 3 pontos por polígono.");
      return;
    }
    setPolygons((prev) =>
      prev.map((p, pi) => {
        if (pi !== polyIdx) return p;
        return { ...p, coordenadas: p.coordenadas.filter((_, vi) => vi !== vertIdx) };
      })
    );
  };

  // Change polygon color
  const changePolygonColor = (polyIdx: number, color: string) => {
    setPolygons((prev) =>
      prev.map((p, pi) => (pi === polyIdx ? { ...p, cor: color } : p))
    );
  };

  const handleSave = async () => {
    if (!currentImageUrl) {
      toast.error("Envie uma imagem do mapa.");
      return;
    }
    setSaving(true);
    let currentMapaId = mapaId;
    if (!currentMapaId) {
      const { data, error } = await supabase
        .from("mapas")
        .insert({ fazenda_id: fazendaId, imagem_url: currentImageUrl })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Erro ao criar mapa.");
        setSaving(false);
        return;
      }
      currentMapaId = data.id;
    } else {
      await supabase.from("mapas").update({ imagem_url: currentImageUrl }).eq("id", currentMapaId);
    }
    await supabase.from("pastos_mapa").delete().eq("mapa_id", currentMapaId);
    if (polygons.length > 0) {
      const rows = polygons.map((p) => ({
        mapa_id: currentMapaId!,
        pasto_id: p.pasto_id,
        coordenadas: p.coordenadas,
        cor: p.cor,
      }));
      const { error } = await supabase.from("pastos_mapa").insert(rows);
      if (error) {
        toast.error("Erro ao salvar pastos no mapa.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast.success("Mapa salvo com sucesso!");
    onSaved();
  };

  const toPoints = (coords: number[][]) =>
    coords.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ");

  const usedPastoIds = new Set(polygons.map((p) => p.pasto_id));
  const availablePastos = pastos.filter((p) => !usedPastoIds.has(p.id));

  return (
    <div className="space-y-4">
      {!currentImageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upload do Mapa</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="mapa-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para enviar PNG, JPG ou PDF</p>
                  </>
                )}
              </div>
            </Label>
            <Input
              id="mapa-upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={handleImageUpload}
            />
          </CardContent>
        </Card>
      )}

      {currentImageUrl && (
        <>
          <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border bg-muted">
            <img
              src={currentImageUrl}
              alt="Mapa"
              className="w-full h-auto block"
              onLoad={handleImageLoad}
              draggable={false}
            />
            {imgSize.width > 0 && (
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                preserveAspectRatio="none"
                onClick={handleCanvasClick}
                style={{ cursor: drawing ? "crosshair" : "default" }}
              >
                {polygons.map((p, polyIdx) => {
                  const isEditing = editingPolygonIndex === polyIdx;
                  const coords = p.coordenadas;
                  return (
                    <g key={polyIdx}>
                      <polygon
                        points={toPoints(coords)}
                        fill={isEditing ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)"}
                        stroke={p.cor}
                        strokeWidth={isEditing ? 3 : 2}
                        className={!drawing && !isEditing ? "cursor-pointer" : ""}
                        onClick={(e) => {
                          if (!drawing) {
                            e.stopPropagation();
                            setEditingPolygonIndex(isEditing ? null : polyIdx);
                          }
                        }}
                      />

                      {/* Editable edges - click to add point */}
                      {isEditing &&
                        coords.map(([x1, y1], i) => {
                          const [x2, y2] = coords[(i + 1) % coords.length];
                          return (
                            <line
                              key={`edge-${i}`}
                              x1={x1 * scaleX}
                              y1={y1 * scaleY}
                              x2={x2 * scaleX}
                              y2={y2 * scaleY}
                              stroke="transparent"
                              strokeWidth={12}
                              className="cursor-cell"
                              onClick={(e) => handleEdgeClick(e, polyIdx, i)}
                            />
                          );
                        })}

                      {/* Vertex handles */}
                      {isEditing &&
                        coords.map(([x, y], vertIdx) => (
                          <circle
                            key={`v-${vertIdx}`}
                            cx={x * scaleX}
                            cy={y * scaleY}
                            r={6}
                            fill="white"
                            stroke={p.cor}
                            strokeWidth={2}
                            className="cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => handleVertexMouseDown(e, polyIdx, vertIdx)}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              setDraggingVertex({ polyIdx, vertIdx });
                            }}
                            onContextMenu={(e) => handleVertexDelete(e, polyIdx, vertIdx)}
                            onDoubleClick={(e) => handleVertexDelete(e, polyIdx, vertIdx)}
                          />
                        ))}
                    </g>
                  );
                })}

                {/* Current drawing points */}
                {currentPoints.length > 0 && (
                  <>
                    <polyline
                      points={currentPoints.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ")}
                      fill="none"
                      stroke={selectedColor}
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                    {currentPoints.map(([x, y], i) => (
                      <circle key={i} cx={x * scaleX} cy={y * scaleY} r={4} fill={selectedColor} />
                    ))}
                  </>
                )}
              </svg>
            )}
          </div>

          {/* Editing toolbar for selected polygon */}
          {editingPolygonIndex !== null && (
            <Card className="border-primary/40">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <GripVertical className="w-4 h-4" />
                    Editando: {pastos.find((p) => p.id === polygons[editingPolygonIndex]?.pasto_id)?.nome || "Pasto"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditingPolygonIndex(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Cor da linha:</span>
                  {LINE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        polygons[editingPolygonIndex]?.cor === c.value
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                      onClick={() => changePolygonColor(editingPolygonIndex, c.value)}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Arraste os pontos • Clique na borda para adicionar • Duplo-clique no ponto para excluir
                </p>
              </CardContent>
            </Card>
          )}

          {/* Drawing toolbar */}
          <div className="flex flex-wrap gap-2">
            {!drawing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDrawing(true);
                  setEditingPolygonIndex(null);
                }}
                disabled={availablePastos.length === 0}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" /> Desenhar Pasto
              </Button>
            ) : (
              <>
                <div className="flex-1 min-w-[150px]">
                  <Select value={selectedPastoId} onValueChange={setSelectedPastoId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Vincular a pasto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePastos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: selectedColor }} />
                      <Palette className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2">
                    {LINE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted ${
                          selectedColor === c.value ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => setSelectedColor(c.value)}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <Button size="sm" onClick={finishPolygon} disabled={currentPoints.length < 3} className="gap-1.5">
                  <Save className="w-4 h-4" /> Concluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPoints((prev) => prev.slice(0, -1))}
                  disabled={currentPoints.length === 0}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDrawing(false);
                    setCurrentPoints([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Linked pastos list */}
          {polygons.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground uppercase">Pastos Vinculados</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {polygons.map((p, i) => {
                  const pasto = pastos.find((opt) => opt.id === p.pasto_id);
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.cor }} />
                        <span
                          className={`cursor-pointer ${editingPolygonIndex === i ? "font-semibold text-primary" : ""}`}
                          onClick={() => setEditingPolygonIndex(editingPolygonIndex === i ? null : i)}
                        >
                          {pasto?.nome || p.pasto_id}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePolygon(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
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
