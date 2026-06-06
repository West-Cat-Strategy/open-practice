"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import ExternalUploadRunner from "./external-uploads/ExternalUploadRunner";
import GuestSessionRunner from "./guest-sessions/GuestSessionRunner";
import IntakeFormRunner from "./intake-forms/IntakeFormRunner";
import { publicTokenFromLocationHash } from "./publicTokenClient";
import { PublicStatusMessage, PublicTokenShell } from "./publicTokenUi";
import ShareLinkRunner from "./share-links/ShareLinkRunner";

type PublicTokenHashKind = "share-links" | "external-uploads" | "intake-forms" | "guest-sessions";

interface PublicTokenHashEntryProps {
  apiBaseUrl: string;
  kind: PublicTokenHashKind;
}

export default function PublicTokenHashEntry({ apiBaseUrl, kind }: PublicTokenHashEntryProps) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(publicTokenFromLocationHash());
  }, []);

  if (token === null) {
    return (
      <PublicTokenShell
        description="Preparing secure access."
        eyebrow="Secure link"
        icon={<ShieldCheck size={22} />}
        title="Secure access"
      >
        <PublicStatusMessage>Loading secure link...</PublicStatusMessage>
      </PublicTokenShell>
    );
  }

  if (!token) {
    return (
      <PublicTokenShell
        description="This secure link is missing its access token."
        eyebrow="Secure link"
        icon={<ShieldCheck size={22} />}
        title="Secure access unavailable"
      >
        <PublicStatusMessage>Secure token missing.</PublicStatusMessage>
      </PublicTokenShell>
    );
  }

  if (kind === "share-links") return <ShareLinkRunner apiBaseUrl={apiBaseUrl} token={token} />;
  if (kind === "external-uploads") {
    return <ExternalUploadRunner apiBaseUrl={apiBaseUrl} token={token} />;
  }
  if (kind === "intake-forms") return <IntakeFormRunner apiBaseUrl={apiBaseUrl} token={token} />;
  return <GuestSessionRunner apiBaseUrl={apiBaseUrl} token={token} />;
}
