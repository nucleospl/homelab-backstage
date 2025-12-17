import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';

export type ArtifactoryChild = {
  uri: string; // e.g. "/2.2.1-next-SNAPSHOT"
  folder: boolean | string; // some installs return boolean, some return "true"/"false"
};

export type ArtifactoryFolderInfo = {
  repo: string;
  path: string; // e.g. "/com/maksonlee/beepbeep"
  children?: ArtifactoryChild[];
  created?: string;
  createdBy?: string;
  lastModified?: string;
  modifiedBy?: string;
  lastUpdated?: string;
};

export type ArtifactoryFileInfo = {
  repo: string;
  path: string; // e.g. "/com/maksonlee/beepbeep/file.txt"
  downloadUri: string;
  created?: string;
  createdBy?: string;
  lastModified?: string;
  modifiedBy?: string;
  lastUpdated?: string;
  size?: string;
  mimeType?: string;
  checksums?: {
    md5?: string;
    sha1?: string;
    sha256?: string;
  };
};

export interface ArtifactoryBrowserApi {
  getFolderInfo(
    repo: string,
    folderPath: string,
  ): Promise<ArtifactoryFolderInfo>;
  getFileInfo(repo: string, filePath: string): Promise<ArtifactoryFileInfo>;
}

export const artifactoryBrowserApiRef = createApiRef<ArtifactoryBrowserApi>({
  id: 'plugin.artifactory-browser.service',
});

function normalizePath(p: string) {
  const trimmed = (p ?? '').trim();
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
}

function encodePath(p: string) {
  const norm = normalizePath(p);
  if (!norm) return '';
  return norm.split('/').map(encodeURIComponent).join('/');
}

export class ArtifactoryBrowserClient implements ArtifactoryBrowserApi {
  constructor(
    private readonly deps: { discoveryApi: DiscoveryApi; fetchApi: FetchApi },
  ) {}

  private async proxyBase() {
    // -> https://backstage.../api/proxy
    return this.deps.discoveryApi.getBaseUrl('proxy');
  }

  async getFolderInfo(repo: string, folderPath: string) {
    const base = await this.proxyBase();
    const full = encodePath(folderPath);

    const url =
      full.length > 0
        ? `${base}/artifactory/api/storage/${encodeURIComponent(repo)}/${full}`
        : `${base}/artifactory/api/storage/${encodeURIComponent(repo)}`;

    const resp = await this.deps.fetchApi.fetch(url);
    if (!resp.ok) {
      throw new Error(`FolderInfo failed: ${resp.status} ${await resp.text()}`);
    }
    return (await resp.json()) as ArtifactoryFolderInfo;
  }

  async getFileInfo(repo: string, filePath: string) {
    const base = await this.proxyBase();
    const full = encodePath(filePath);

    const url = `${base}/artifactory/api/storage/${encodeURIComponent(
      repo,
    )}/${full}`;

    const resp = await this.deps.fetchApi.fetch(url);
    if (!resp.ok) {
      throw new Error(`FileInfo failed: ${resp.status} ${await resp.text()}`);
    }
    return (await resp.json()) as ArtifactoryFileInfo;
  }
}
