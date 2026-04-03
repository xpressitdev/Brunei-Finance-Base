import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center text-center p-4 bg-background">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="text-xl font-semibold text-muted-foreground">Page Not Found</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
