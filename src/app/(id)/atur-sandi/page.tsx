import { Suspense } from "react";
import { AuthFrame } from "@/components/ops/auth-frame";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Atur kata sandi" };

export default function ResetPage() {
  return (
    <AuthFrame title="Kata sandi baru" subtitle="Tautan ini hanya berlaku sekali dan kedaluwarsa dalam 30 menit.">
      <Suspense fallback={<p className="text-sm text-white/70">Memuat formulir...</p>}>
        <ResetForm />
      </Suspense>
    </AuthFrame>
  );
}
