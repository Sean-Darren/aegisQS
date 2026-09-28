"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Toast as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
type ToastMessage = {
  id: number;
  message: string;
  status: "success" | "error" | "info";
};
const ToastContext = createContext<
  ((message: string, status?: ToastMessage["status"]) => void) | null
>(null);
export function Toast({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        "floating-layer rounded-md border border-line border-l-[3px] bg-panel p-4 text-sm text-ink data-[state=closed]:hidden",
        className,
      )}
      {...props}
    />
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const t = useTranslations("Common");
  const show = useCallback(
    (message: string, status: ToastMessage["status"] = "info") =>
      setItems((old) => [
        ...old,
        { id: Date.now() + old.length, message, status },
      ]),
    [],
  );
  return (
    <ToastContext.Provider value={show}>
      <Primitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <Toast
            key={item.id}
            duration={4500}
            onOpenChange={(open) => {
              if (!open) setItems((old) => old.filter((x) => x.id !== item.id));
            }}
            style={{
              borderLeftColor: `var(--${item.status === "error" ? "risk" : item.status === "success" ? "tolerance" : "clay-600"})`,
            }}
          >
            <Primitive.Description>{item.message}</Primitive.Description>
            <Primitive.Close
              aria-label={t("close")}
              className="ml-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            >
              <X size={14} strokeWidth={1.5} />
            </Primitive.Close>
          </Toast>
        ))}
        <Primitive.Viewport className="fixed bottom-4 right-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" />
      </Primitive.Provider>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("ToastProvider is required");
  return context;
}
