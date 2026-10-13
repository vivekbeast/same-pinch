// Lazy wrapper: vaul + Radix Dialog download the first time any sheet opens, not on first paint.
import { lazy, Suspense, useState, type ReactNode } from "react";

const SheetImpl = lazy(() => import("./sheet-impl"));

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Sheet(props: SheetProps) {
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true); // derived from props; keeps it mounted for the close animation
  if (!used) return null;
  return (
    <Suspense fallback={null}>
      <SheetImpl {...props} />
    </Suspense>
  );
}
