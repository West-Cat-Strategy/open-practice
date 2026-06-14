import type {
  AccessLogRecord,
  ExternalUploadLinkRecord,
  PortalGrant,
  PortalDocumentAccess,
  ShareLinkRecord,
} from "@open-practice/domain";

export interface ShareLinkListOptions {
  matterId?: string;
}

export interface ExternalUploadLinkListOptions {
  matterId?: string;
}

export interface AccessLogListOptions {
  shareLinkId?: string;
  externalUploadLinkId?: string;
  intakeFormLinkId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface PortalDocumentAccessListOptions {
  matterId?: string;
  documentId?: string;
  portalGrantId?: string;
}

export interface PortalAccessRepository {
  listPortalGrants(firmId: string): Promise<PortalGrant[]>;
  createPortalGrant(grant: PortalGrant): Promise<PortalGrant>;
  listPortalDocumentAccess(
    firmId: string,
    options?: PortalDocumentAccessListOptions,
  ): Promise<PortalDocumentAccess[]>;
  createPortalDocumentAccess(access: PortalDocumentAccess): Promise<PortalDocumentAccess>;
  revokePortalDocumentAccess(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<PortalDocumentAccess | undefined>;
  listShareLinks(firmId: string, options?: ShareLinkListOptions): Promise<ShareLinkRecord[]>;
  createShareLink(link: ShareLinkRecord): Promise<ShareLinkRecord>;
  getShareLink(firmId: string, id: string): Promise<ShareLinkRecord | undefined>;
  getShareLinkByTokenHash(tokenHash: string): Promise<ShareLinkRecord | undefined>;
  revokeShareLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ShareLinkRecord | undefined>;
  listExternalUploadLinks(
    firmId: string,
    options?: ExternalUploadLinkListOptions,
  ): Promise<ExternalUploadLinkRecord[]>;
  createExternalUploadLink(link: ExternalUploadLinkRecord): Promise<ExternalUploadLinkRecord>;
  getExternalUploadLinkByTokenHash(
    tokenHash: string,
  ): Promise<ExternalUploadLinkRecord | undefined>;
  revokeExternalUploadLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined>;
  claimExternalUploadUse(input: {
    firmId: string;
    id: string;
    usedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined>;
  createAccessLog(log: AccessLogRecord): Promise<AccessLogRecord>;
  listAccessLogs(firmId: string, options?: AccessLogListOptions): Promise<AccessLogRecord[]>;
}
