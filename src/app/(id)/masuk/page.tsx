import { Suspense } from "react";
import { AuthFrame } from "@/components/ops/auth-frame";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <AuthFrame backdrop="particles" title="Masuk" subtitle="Peta monitoring terbuka setelah akun dikenali. Peran dibaca dari server.">
      <Suspense fallback={<p className="text-sm text-white/70">Memuat formulir...</p>}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
