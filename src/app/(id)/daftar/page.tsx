import { AuthFrame } from "@/components/ops/auth-frame";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <AuthFrame title="Daftar" subtitle="Akun baru berstatus menunggu. Admin menetapkan peran setelah memeriksa data.">
      <RegisterForm />
    </AuthFrame>
  );
}
