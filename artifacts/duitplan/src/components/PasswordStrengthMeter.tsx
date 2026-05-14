import { passwordStrength, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { cn } from "@/lib/utils";

interface Props {
  password: string;
  className?: string;
}

const BAR_COLORS = [
  "bg-muted",
  "bg-rose-400",
  "bg-amber-400",
  "bg-yellow-400",
  "bg-emerald-500",
];

export function PasswordStrengthMeter({ password, className }: Props) {
  const { score, label } = passwordStrength(password);
  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const noDigit = password.length > 0 && !/\d/.test(password);

  return (
    <div className={cn("space-y-1", className)} aria-live="polite" data-testid="password-strength">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= score ? BAR_COLORS[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span data-testid="password-strength-label">
          {password.length === 0 ? `Use ${PASSWORD_MIN_LENGTH}+ characters and at least one digit.` : `Strength: ${label}`}
        </span>
        {(tooShort || noDigit) && (
          <span className="text-rose-600">
            {tooShort ? `${PASSWORD_MIN_LENGTH - password.length} more` : "add a digit"}
          </span>
        )}
      </div>
    </div>
  );
}
