import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, GripVertical, Loader2 } from "lucide-react";

interface ImageUploadFieldProps {
  label: string;
  folder: string;
  multiple?: boolean;
  urls: string[];
  onChange: (urls: string[]) => void;
}

export default function ImageUploadField({ label, folder, multiple = false, urls, onChange }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("landing").upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("landing").getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
    }
    if (multiple) {
      onChange([...urls, ...newUrls]);
    } else {
      onChange(newUrls.slice(0, 1));
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => {
    onChange(urls.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...urls];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    onChange(copy);
  };

  const moveDown = (index: number) => {
    if (index >= urls.length - 1) return;
    const copy = [...urls];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* Preview grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {urls.map((url, i) => (
            <div key={url} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
              <img src={url} alt="" className="w-full h-28 object-cover" />
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {multiple && (
                  <>
                    <button onClick={() => moveUp(i)} className="bg-background/80 rounded p-1 hover:bg-background" title="Mover para cima">
                      <GripVertical className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </>
                )}
                <button onClick={() => remove(i)} className="bg-destructive/80 rounded p-1 hover:bg-destructive" title="Remover">
                  <X className="w-3.5 h-3.5 text-destructive-foreground" />
                </button>
              </div>
              {multiple && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 rounded px-1.5 py-0.5 text-foreground font-medium">
                  {i + 1}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || (!multiple && urls.length >= 1)}
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Enviando..." : multiple ? "Adicionar imagens" : urls.length ? "Substituir imagem" : "Enviar imagem"}
        </Button>
      </div>
    </div>
  );
}
