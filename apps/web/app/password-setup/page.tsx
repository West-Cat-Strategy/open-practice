import { browserApiBaseUrl } from "../api-base-urls";
import PasswordSetupClient from "./PasswordSetupClient";

type PasswordSetupSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PasswordSetupPage({
  searchParams,
}: {
  searchParams?: PasswordSetupSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <PasswordSetupClient
      apiBaseUrl={browserApiBaseUrl}
      token={firstSearchParam(resolvedSearchParams.token)}
      userId={firstSearchParam(resolvedSearchParams.userId)}
    />
  );
}
