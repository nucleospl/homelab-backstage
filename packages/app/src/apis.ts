import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  githubAuthApiRef,
} from '@backstage/core-plugin-api';

import {
  artifactoryBrowserApiRef,
  ArtifactoryBrowserClient,
} from '@internal/backstage-plugin-artifactory-browser';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),

  // Artifactory Browser API (frontend plugin -> calls Backstage proxy)
  createApiFactory({
    api: artifactoryBrowserApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new ArtifactoryBrowserClient({ discoveryApi, fetchApi }),
  }),
];
