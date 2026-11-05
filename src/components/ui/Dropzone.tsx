// Original Smart QS composition of react-dropzone (react-dropzone maintainers, MIT).
// Reference: https://github.com/react-dropzone/react-dropzone
"use client";
import { useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { useTranslations } from "next-intl";
import { Upload, TriangleAlert } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
export function Dropzone({
  label,
  onFiles,
  onRejected,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
}: {
  label: string;
  onFiles: (files: File[]) => void;
  onRejected?: (files: FileRejection[]) => void;
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("Primitives");
  const [rejected, setRejected] = useState(false);
  const { getRootProps, getInputProps, open, isDragActive, isDragReject } =
    useDropzone({
      accept,
      maxSize,
      maxFiles,
      multiple,
      disabled,
      noClick: true,
      noKeyboard: true,
      onDrop: (accepted, rejections) => {
        setRejected(rejections.length > 0);
        if (accepted.length) onFiles(accepted);
        if (rejections.length) onRejected?.(rejections);
      },
    });
  return (
    <div
      {...getRootProps({
        role: "group",
        "aria-label": label,
        "aria-disabled": disabled,
      })}
      className={cn(
        "rounded-lg border border-dashed border-line-strong bg-panel p-5 text-sm text-ink",
        isDragActive && "border-clay-600 bg-limewash-100",
        disabled && "opacity-45",
      )}
    >
      <input {...getInputProps({ "aria-label": label })} />
      <div className="flex items-center gap-3">
        <Upload size={20} strokeWidth={1.5} aria-hidden="true" />
        <p>{t("dropFiles")}</p>
      </div>
      <Button
        variant="outline"
        className="mt-3"
        onClick={open}
        disabled={disabled}
      >
        {t("chooseFiles")}
      </Button>
      {(rejected || isDragReject) && (
        <p role="alert" className="mt-3 flex items-center gap-1 text-risk">
          <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
          {t("fileRejected")}
        </p>
      )}
    </div>
  );
}
