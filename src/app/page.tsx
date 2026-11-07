import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Setup complete
          </Badge>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">
              State AI Law Compliance Mapper
            </h1>
          </CardTitle>
          <CardDescription>
            Placeholder page. Features coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
