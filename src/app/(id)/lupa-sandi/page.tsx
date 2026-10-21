import { AuthFrame } from "@/components/ops/auth-frame";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Lupa kata sandi" };

export default function ForgotPage() {
  return (
    <AuthFrame title="Lupa kata sandi" subtitle="Tautan reset dikirim hanya jika layanan surel siap. Kata sandi tidak dikirim lewat email.">
      <ForgotForm />
    </AuthFrame>
  );
}
