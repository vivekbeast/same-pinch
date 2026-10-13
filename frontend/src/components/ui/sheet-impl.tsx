// One API, two renderings (docs/COMPONENTS.md ResponsiveSheet): phone → vaul bottom sheet with a
// drag handle; tablet/desktop → centred Radix dialog. Focus trap, Esc and focus return come free.
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { useFamily } from "@/lib/use-family";

export default function SheetImpl({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const family = useFamily();

  if (family === "phone") {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[32px] bg-surface px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] outline-none sm:px-6">
            <div aria-hidden className="mx-auto mb-5 h-1.5 w-12 shrink-0 rounded-full bg-line" />
            <Drawer.Title className="text-section font-bold text-ink">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1 text-ink-muted">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
            <div className="mt-5 overflow-y-auto">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(560px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-7 pop outline-none xl:max-h-[80dvh] xl:p-8">
          <Dialog.Title className="text-section font-bold text-ink">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-1 text-ink-muted">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
