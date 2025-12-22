import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { getErrorMessage } from "@/lib/utils/auth-messages";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  // Use whitelisted error messages to prevent phishing via crafted URLs
  const errorMessage = getErrorMessage(params?.error);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {errorMessage || "An unexpected error occurred."}
      </p>
      <Button variant="outline" className="w-full" asChild>
        <Link href="/login">Back to login</Link>
      </Button>
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
