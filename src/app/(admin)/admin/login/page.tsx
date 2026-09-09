import { Suspense } from "react";
import "@/components/admin/admin.css";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-svh place-items-center bg-deep-black text-soft-grey">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
