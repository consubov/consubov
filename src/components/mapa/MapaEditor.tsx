import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Pencil, Trash2, Plus, Save, X, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface PastoOption {
  id: string;
  nome: string;
}

interface DrawnPolygon {
  id?: string;
  pasto_id: string;
  coordenadas: number[][];
}

interface Props {
  fazendaId: string;
  mapaId?: string;
  imagemUrl?: string;
  existingPolygons?: DrawnPolygon[];
  onSaved: () => void;
}

export default function MapaEditor({ fazendaId, mapaId, imagemUrl, existingPolygons, onSaved }: Props) {
  const [uploading, setUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imagemUrl || "");
  const [pastos, setPastos] = useState<PastoOption[]>([]);
  const [polygons, setPolygons] = useState<DrawnPolygon[]>(existingPolygons || []);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [selectedPastoId, setSelectedPastoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (img) {
        setImgSize({ width: img.clientWidth, height: img.clientHeight });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scaleX = imgSize.width / naturalSize.width;
  const scaleY = imgSize.height / naturalSize.height;

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;

    setCurrentPoints((prev) => [...prev, [Math.round(x), Math.round(y)]]);
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

    setPolygons((prev) => [...prev, { pasto_id: selectedPastoId, coordenadas: currentPoints }]);
    setCurrentPoints([]);
    setSelectedPastoId("");
    setDrawing(false);
    toast.success("Pasto adicionado ao mapa!");
  };

  const removePolygon = (index: number) => {
    setPolygons((prev) => prev.filter((_, i) => i !== index));
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
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                preserveAspectRatio="none"
                onClick={handleCanvasClick}
                style={{ cursor: drawing ? "crosshair" : "default" }}
              >
                {polygons.map((p, i) => (
                  <polygon
                    key={i}
                    points={toPoints(p.coordenadas)}
                    fill="rgba(59, 130, 246, 0.3)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                ))}

                {currentPoints.length > 0 && (
                  <>
                    <polyline
                      points={currentPoints.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ")}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                    {currentPoints.map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x * scaleX}
                        cy={y * scaleY}
                        r={4}
                        fill="#ef4444"
                      />
                    ))}
                  </>
                )}
              </svg>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!drawing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDrawing(true)}
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
                      <span>{pasto?.nome || p.pasto_id}</span>
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
