"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Play } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VideoUploadFieldProps {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function VideoUploadField({
  label,
  value,
  onChange,
  disabled,
}: VideoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const result = await api.uploadVideo(file);
      if (result?.url) {
        onChange(result.url);
      } else {
        setError(result?.message ?? "Upload failed");
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      {value ? (
        <div className="relative rounded-lg border border-gray-200 bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Play className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-700">{value}</p>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Open video
              </a>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                title="Remove video"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600",
            (disabled || uploading) && "cursor-not-allowed opacity-50"
          )}
        >
          <Upload className="h-5 w-5" />
          {uploading ? "Uploading…" : "Click to upload video (mp4, webm, mov — max 500 MB)"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
