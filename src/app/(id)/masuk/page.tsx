import { Suspense } from "react";
import { AuthFrame } from "@/components/ops/auth-frame";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <AuthFrame title="Masuk" subtitle="Gunakan akun yang diberikan admin Pusdalops.">
      <Suspense fallback={<p className="text-sm text-white/70">Memuat formulir...</p>}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
