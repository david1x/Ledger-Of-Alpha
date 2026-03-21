"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen, BookmarkPlus, Copy, Trash2, Check, X, Pencil } from "lucide-react";
import type { LayoutTemplate, BuiltInTemplate } from "./DashboardShell";

interface TemplatePanelProps {
  templates: (LayoutTemplate | BuiltInTemplate)[];
  onSave: (name: string) => void;
  onLoad: (template: LayoutTemplate | BuiltInTemplate) => void;
  onDelete: (templateId: string) => void;
  onSaveAs: (preset: BuiltInTemplate, newName: string) => void;
  onEditBuiltIn: (preset: BuiltInTemplate) => void;
  isGuest: boolean;
  isAdmin: boolean;
}

export default function TemplatePanel({
  templates,
  onSave,
  onLoad,
  onDelete,
  onSaveAs,
  onEditBuiltIn,
  isGuest,
  isAdmin,
}: TemplatePanelProps) {
  const [open, setOpen] = useState(false);
  const [applyConfirm, setApplyConfirm] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");
  const [copySource, setCopySource] = useState<BuiltInTemplate | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [editConfirm, setEditConfirm] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setApplyConfirm(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setApplyConfirm(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleApplyClick = (templateId: string) => {
    if (applyConfirm === templateId) {
      // Cancel confirm
      setApplyConfirm(null);
    } else {
      setApplyConfirm(templateId);
    }
  };

  const handleApplyConfirm = (template: LayoutTemplate | BuiltInTemplate) => {
    onLoad(template);
    setApplyConfirm(null);
    setOpen(false);
  };

  const handleCopyClick = (preset: BuiltInTemplate) => {
    setCopySource(preset);
    setInputName(`${preset.name} (copy)`);
    inputRef.current?.focus();
  };

  const handleSave = useCallback(() => {
    const name = inputName.trim();
    if (!name || isGuest) return;

    if (copySource) {
      onSaveAs(copySource, name);
      setCopySource(null);
    } else {
      onSave(name);
    }

    setInputName("");
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1500);
  }, [inputName, isGuest, copySource, onSave, onSaveAs]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  const isBuiltIn = (t: LayoutTemplate | BuiltInTemplate): t is BuiltInTemplate =>
    "readonly" in t && t.readonly === true;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl transition-colors ${
          open
            ? "bg-indigo-500 text-white"
            : "hover:dark:bg-slate-800 hover:bg-white text-slate-500"
        }`}
        title="Templates"
        aria-label="Manage layout templates"
      >
        <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-3 w-72 rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b dark:border-slate-800 border-slate-100">
            <p className="text-xs font-bold dark:text-slate-200 text-slate-700 uppercase tracking-wider">
              Layout Templates
            </p>
          </div>

          {/* Template list */}
          <div className="max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs dark:text-slate-500 text-slate-400">No templates yet. Save your current layout below.</p>
              </div>
            ) : (
              <div className="py-2">
                {templates.map(template => (
                  <div key={template.id} className="px-3 py-2">
                    {applyConfirm === template.id ? (
                      /* Inline apply confirmation row */
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs dark:text-slate-300 text-slate-600 font-medium truncate">
                          Apply this layout?
                        </span>
                        <button
                          onClick={() => handleApplyConfirm(template)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Yes
                        </button>
                        <button
                          onClick={() => setApplyConfirm(null)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg dark:bg-slate-700 bg-slate-200 hover:dark:bg-slate-600 hover:bg-slate-300 dark:text-slate-300 text-slate-600 text-xs font-bold transition-colors"
                        >
                          <X className="w-3 h-3" />
                          No
                        </button>
                      </div>
                    ) : editConfirm === template.id && isBuiltIn(template) ? (
                      /* Inline edit confirmation row (admin only) */
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs dark:text-amber-300 text-amber-600 font-medium truncate">
                          Save current layout as default?
                        </span>
                        <button
                          onClick={() => { onEditBuiltIn(template); setEditConfirm(null); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Yes
                        </button>
                        <button
                          onClick={() => setEditConfirm(null)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg dark:bg-slate-700 bg-slate-200 hover:dark:bg-slate-600 hover:bg-slate-300 dark:text-slate-300 text-slate-600 text-xs font-bold transition-colors"
                        >
                          <X className="w-3 h-3" />
                          No
                        </button>
                      </div>
                    ) : (
                      /* Normal template row */
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold dark:text-slate-200 text-slate-700 truncate">
                            {template.name}
                          </p>
                          {isBuiltIn(template) && (
                            <p className="text-[10px] dark:text-slate-500 text-slate-400">Built-in preset</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleApplyClick(template.id)}
                            className="px-2.5 py-1 rounded-lg dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 dark:text-slate-300 text-slate-600 text-xs font-bold transition-colors"
                          >
                            Apply
                          </button>
                          {isBuiltIn(template) ? (
                            <>
                              {isAdmin && (
                                <button
                                  onClick={() => setEditConfirm(template.id)}
                                  className="p-1.5 rounded-lg dark:bg-slate-800 bg-slate-100 hover:dark:bg-amber-900/40 hover:bg-amber-50 dark:text-slate-400 text-slate-500 hover:text-amber-400 transition-colors"
                                  title="Edit default (saves current layout as this preset for all users)"
                                  aria-label={`Edit ${template.name} default layout`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleCopyClick(template)}
                                className="p-1.5 rounded-lg dark:bg-slate-800 bg-slate-100 hover:dark:bg-slate-700 hover:bg-slate-200 dark:text-slate-400 text-slate-500 transition-colors"
                                title="Copy as new template"
                                aria-label={`Copy ${template.name} as new template`}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => onDelete(template.id)}
                              disabled={isGuest}
                              className="p-1.5 rounded-lg dark:bg-slate-800 bg-slate-100 hover:dark:bg-red-900/40 hover:bg-red-50 dark:text-slate-400 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Delete template"
                              aria-label={`Delete ${template.name}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t dark:border-slate-800 border-slate-100" />

          {/* Save current layout section */}
          <div className="px-3 py-3">
            {isGuest ? (
              <p className="text-xs dark:text-slate-500 text-slate-400 text-center py-1">
                Sign in to save templates
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={copySource ? `Copy of ${copySource.name}` : "Template name..."}
                  className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 dark:text-slate-200 text-slate-700 dark:placeholder-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!inputName.trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shrink-0"
                  title="Save current layout as template"
                >
                  {savedFeedback ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3 h-3" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            )}
            {copySource && !isGuest && (
              <p className="mt-1.5 text-[10px] dark:text-slate-500 text-slate-400">
                Saving copy of "{copySource.name}"
                <button
                  onClick={() => { setCopySource(null); setInputName(""); }}
                  className="ml-1 underline hover:dark:text-slate-300 hover:text-slate-600"
                >
                  Cancel
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
