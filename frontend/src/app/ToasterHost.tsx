import { useEffect } from "react";
import { Toaster } from "sonner";
import { toasterMounted } from "@/lib/toast";
import { useFamily } from "@/lib/use-family";

export default function ToasterHost() {
  const family = useFamily();
  useEffect(() => toasterMounted(), []);
  return (
    <Toaster
      position={family === "desktop" ? "bottom-right" : "bottom-center"}
      offset={family === "phone" ? 104 : 24}
      toastOptions={{ className: "!rounded-tile !bg-ink !text-white !border-0 !font-sans !text-[15px]" }}
    />
  );
}
