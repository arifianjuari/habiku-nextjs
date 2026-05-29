import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SectionPlaceholderProps = {
  title: string;
  description: string;
  phase?: string;
};

export function SectionPlaceholder({
  title,
  description,
  phase = "W1",
}: SectionPlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <Badge variant="outline">{phase}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Halaman ini sudah terhubung ke routing dan layout. Implementasi data Supabase
        mengikuti <code className="text-xs">docs/implementation-roadmap-nextjs.md</code>.
      </CardContent>
    </Card>
  );
}
