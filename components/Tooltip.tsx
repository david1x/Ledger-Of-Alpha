"use client";
import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

interface Props {
  text: string;
  children?: React.ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<"top" | "bottom">("top");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 80 ? "bottom" : "top");
    }
  }, [show]);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children ?? <Info className="w-3 h-3 dark:text-slate-500 text-slate-400 cursor-help" />}
      {show && (
        <div
          ref={ref}
          className={`absolute z-50 left-1/2 -translate-x-1/2 px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal rounded-lg dark:bg-slate-700 bg-slate-800 text-white shadow-lg whitespace-nowrap pointer-events-none ${
            pos === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
