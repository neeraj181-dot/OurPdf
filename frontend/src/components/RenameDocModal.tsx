import React, { useState, useEffect, useRef } from "react";
import { Edit3, X, Check, FileText } from "lucide-react";
import { soundEffects } from "../lib/audio";

interface RenameDocModalProps {
  isOpen: boolean;
  currentFilename: string;
  onClose: () => void;
  onRename: (newFilename: string) => Promise<void> | void;
}

export const RenameDocModal: React.FC<RenameDocModalProps> = ({
  isOpen,
  currentFilename,
  onClose,
  onRename,
}) => {
  // Extract extension and base name
  const extMatch = currentFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : ".pdf";
  const baseName = currentFilename.replace(new RegExp(`${ext}$`, "i"), "");

  const [name, setName] = useState(baseName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const match = currentFilename.match(/\.([a-zA-Z0-9]+)$/);
      const e = match ? `.${match[1]}` : ".pdf";
      setName(currentFilename.replace(new RegExp(`${e}$`, "i"), ""));
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentFilename]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please enter a document name.");
      return;
    }

    // Ensure extension is preserved
    const finalFilename = cleanName.toLowerCase().endsWith(ext.toLowerCase())
      ? cleanName
      : `${cleanName}${ext}`;

    setIsSaving(true);
    setError(null);
    try {
      soundEffects.playClick();
      await onRename(finalFilename);
      soundEffects.playSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to rename document.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954]">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Rename Document</h3>
            <p className="text-xs text-zinc-400">Enter a new name for your file</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Document Name</label>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSaving}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#1DB954] text-white text-xs rounded-lg px-3 py-2.5 pr-14 focus:outline-none transition-colors"
                placeholder="document_name"
              />
              <span className="absolute right-3 text-xs text-zinc-500 font-mono select-none">
                {ext}
              </span>
            </div>
            {error && <p className="text-xs text-rose-400 font-medium mt-1">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Rename</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
