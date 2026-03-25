import { Code2, Mail } from "lucide-react";
import { AuthSecondaryButton } from "./auth-form-ui";

export function AuthSocialButtons() {
  return (
    <div className="space-y-3">
      <AuthSecondaryButton>
        <Mail className="h-4 w-4 text-[#09090B]" />
        Continue with Google
      </AuthSecondaryButton>
      <AuthSecondaryButton>
        <Code2 className="h-4 w-4 text-[#09090B]" />
        Continue with GitHub
      </AuthSecondaryButton>
    </div>
  );
}

