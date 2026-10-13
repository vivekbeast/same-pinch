import * as RSwitch from "@radix-ui/react-switch";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors focus-visible:ring-4 focus-visible:ring-brand/30 data-[state=checked]:bg-brand"
    >
      <RSwitch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-surface pop-sm transition-transform data-[state=checked]:translate-x-[22px]" />
    </RSwitch.Root>
  );
}
