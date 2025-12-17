import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState, ErrorPanel, Progress } from '@backstage/core-components';

import {
  Grid,
  Paper,
  Typography,
  Divider,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@material-ui/core';
import { TreeView, TreeItem } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import {
  artifactoryBrowserApiRef,
  ArtifactoryFolderInfo,
  ArtifactoryFileInfo,
} from '../../api';

type NodeKind = 'folder' | 'file';

type NodeState = {
  kind: NodeKind;
  loaded: boolean;
  children?: Array<{ name: string; kind: NodeKind; fullPath: string }>;
};

const LOADING_SUFFIX = '::__loading';

const isFolderChild = (folder: boolean | string) =>
  folder === true || folder === 'true';

function joinPath(parent: string, childUri: string) {
  const child = childUri.replace(/^\/+/, '');
  const p = (parent ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  return p ? `${p}/${child}` : child;
}

export const EntityArtifactoryBrowserContent = () => {
  const api = useApi(artifactoryBrowserApiRef);
  const { entity } = useEntity();

  const repo = entity.metadata.annotations?.['jfrog.io/artifactory-repo'] ?? '';
  const rootPath =
    entity.metadata.annotations?.['jfrog.io/artifactory-path'] ?? '';

  // TreeView nodeId should not be empty string
  const ROOT_ID = '__root__';
  const rootNodeId = useMemo(() => (rootPath ? rootPath : ROOT_ID), [rootPath]);

  const nodeIdToPath = useCallback(
    (nodeId: string) => (nodeId === ROOT_ID ? '' : nodeId),
    [],
  );

  const [nodes, setNodes] = useState<Record<string, NodeState>>({
    [rootNodeId]: { kind: 'folder', loaded: false },
  });

  const [expanded, setExpanded] = useState<string[]>([rootNodeId]);
  const [selected, setSelected] = useState<string>(rootNodeId);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<Error | undefined>(undefined);

  const [folderInfo, setFolderInfo] = useState<
    ArtifactoryFolderInfo | undefined
  >(undefined);
  const [fileInfo, setFileInfo] = useState<ArtifactoryFileInfo | undefined>(
    undefined,
  );

  const ensureFolderLoaded = useCallback(
    async (folderNodeId: string) => {
      if (String(folderNodeId).endsWith(LOADING_SUFFIX)) return;

      const cur = nodes[folderNodeId];
      if (cur?.kind === 'folder' && cur.loaded) return;

      const folderPath = nodeIdToPath(folderNodeId);
      const info = await api.getFolderInfo(repo, folderPath);

      const children = (info.children ?? []).map(c => {
        const kind: NodeKind = isFolderChild(c.folder) ? 'folder' : 'file';
        const fullPath = joinPath(folderPath, c.uri); // actual path (no leading slash)
        const childNodeId = fullPath === '' ? ROOT_ID : fullPath;
        return { name: c.uri.replace(/^\/+/, ''), kind, fullPath: childNodeId };
      });

      // folders first, then files, alphabetical
      children.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setNodes(prev => {
        const next: Record<string, NodeState> = { ...prev };

        next[folderNodeId] = { kind: 'folder', loaded: true, children };

        for (const ch of children) {
          if (!next[ch.fullPath]) {
            next[ch.fullPath] = { kind: ch.kind, loaded: ch.kind === 'file' };
          }
        }

        return next;
      });
    },
    [api, repo, nodes, nodeIdToPath, ROOT_ID],
  );

  const loadSelectionDetails = useCallback(
    async (nodeId: string) => {
      if (String(nodeId).endsWith(LOADING_SUFFIX)) return;

      setErr(undefined);
      setLoading(true);
      setFolderInfo(undefined);
      setFileInfo(undefined);

      try {
        const kind = nodes[nodeId]?.kind ?? 'folder';
        const path = nodeIdToPath(nodeId);

        if (kind === 'folder') {
          const info = await api.getFolderInfo(repo, path);
          setFolderInfo(info);
          await ensureFolderLoaded(nodeId);
        } else {
          const info = await api.getFileInfo(repo, path);
          setFileInfo(info);
        }
      } catch (e: any) {
        setErr(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    },
    [api, repo, nodes, ensureFolderLoaded, nodeIdToPath],
  );

  const openNode = useCallback(
    (nodeId: string, kind: NodeKind) => {
      setSelected(nodeId);

      if (kind === 'folder') {
        setExpanded(prev => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      }

      loadSelectionDetails(nodeId);
    },
    [loadSelectionDetails],
  );

  const handleDownload = useCallback(
    async (fileNodeId: string) => {
      setErr(undefined);
      setLoading(true);
      try {
        const path = nodeIdToPath(fileNodeId);
        const info = await api.getFileInfo(repo, path);

        // redirect to Artifactory download URL (user logs in there)
        window.open(info.downloadUri, '_blank', 'noopener,noreferrer');
      } catch (e: any) {
        setErr(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    },
    [api, repo, nodeIdToPath],
  );

  useEffect(() => {
    if (!repo) return;
    loadSelectionDetails(rootNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, rootNodeId]);

  const onToggle = async (_event: any, nodeIds: string[]) => {
    const filtered = nodeIds.filter(id => !String(id).endsWith(LOADING_SUFFIX));
    setExpanded(filtered);

    const newlyExpanded = filtered.filter(
      id => (nodes[id]?.kind ?? 'folder') === 'folder' && !nodes[id]?.loaded,
    );
    if (newlyExpanded.length === 0) return;

    setErr(undefined);
    setLoading(true);
    try {
      for (const id of newlyExpanded) {
        await ensureFolderLoaded(id);
      }
    } catch (e: any) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  };

  const onSelect = async (_event: any, nodeId: string) => {
    if (String(nodeId).endsWith(LOADING_SUFFIX)) return;
    setSelected(nodeId);
    await loadSelectionDetails(nodeId);
  };

  const renderTree = (nodeId: string) => {
    const node = nodes[nodeId];

    const label =
      nodeId === rootNodeId
        ? rootPath
          ? `${repo}/${rootPath}`
          : repo
        : nodeId.split('/').slice(-1)[0];

    if (!node) {
      return (
        <TreeItem key={nodeId} nodeId={nodeId} label={label}>
          <TreeItem nodeId={`${nodeId}${LOADING_SUFFIX}`} label="Loading..." />
        </TreeItem>
      );
    }

    if (node.kind === 'file') {
      return <TreeItem key={nodeId} nodeId={nodeId} label={label} />;
    }

    const folderChildren = (node.children ?? []).filter(
      c => c.kind === 'folder',
    );

    return (
      <TreeItem key={nodeId} nodeId={nodeId} label={label}>
        {node.loaded ? (
          folderChildren.length > 0 ? (
            folderChildren.map(c => renderTree(c.fullPath))
          ) : null
        ) : (
          <TreeItem nodeId={`${nodeId}${LOADING_SUFFIX}`} label="Loading..." />
        )}
      </TreeItem>
    );
  };

  if (!repo) {
    return (
      <EmptyState
        title="Artifactory is not configured for this entity"
        description="Add annotations: jfrog.io/artifactory-repo and (optional) jfrog.io/artifactory-path"
        missing="info"
      />
    );
  }

  const children = nodes[selected]?.children ?? [];

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Paper style={{ padding: 12, height: '70vh', overflow: 'auto' }}>
          <Typography variant="h6">Artifacts</Typography>
          <Typography variant="body2" color="textSecondary">
            Source: Artifactory · Repo: {repo}
            {rootPath ? ` · Path: ${rootPath}` : ''}
          </Typography>
          <Divider style={{ margin: '12px 0' }} />

          <TreeView
            defaultCollapseIcon={<ExpandMoreIcon />}
            defaultExpandIcon={<ChevronRightIcon />}
            expanded={expanded}
            selected={selected}
            onNodeToggle={onToggle}
            onNodeSelect={onSelect}
          >
            {renderTree(rootNodeId)}
          </TreeView>
        </Paper>
      </Grid>

      <Grid item xs={8}>
        <Paper style={{ padding: 12, height: '70vh', overflow: 'auto' }}>
          <Typography variant="h6">Details</Typography>
          <Divider style={{ margin: '12px 0' }} />

          {loading && <Progress />}
          {err && <ErrorPanel error={err} />}

          {!loading && !err && folderInfo && (
            <>
              <Typography variant="subtitle1">
                Folder: {folderInfo.repo}
                {folderInfo.path}
              </Typography>

              <Divider style={{ margin: '12px 0' }} />

              <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                Children
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell style={{ width: 120 }}>Type</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell style={{ width: 140 }}>Download</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {children.map(ch => (
                    <TableRow hover key={ch.fullPath}>
                      <TableCell>{ch.kind}</TableCell>

                      <TableCell>
                        <Button
                          color="primary"
                          size="small"
                          style={{
                            textTransform: 'none',
                            padding: 0,
                            minWidth: 0,
                          }}
                          onClick={() => openNode(ch.fullPath, ch.kind)}
                        >
                          {ch.name}
                        </Button>
                      </TableCell>

                      <TableCell>
                        {ch.kind === 'file' ? (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleDownload(ch.fullPath)}
                          >
                            Download
                          </Button>
                        ) : (
                          <span />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {children.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="textSecondary">
                          Empty folder
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}

          {!loading && !err && fileInfo && (
            <>
              <Typography variant="subtitle1">
                File: {fileInfo.repo}
                {fileInfo.path}
              </Typography>

              <Divider style={{ margin: '12px 0' }} />

              <Typography variant="body2">
                Size: {fileInfo.size ?? '—'}
              </Typography>
              <Typography variant="body2">
                MIME: {fileInfo.mimeType ?? '—'}
              </Typography>
              <Typography variant="body2">
                SHA256: {fileInfo.checksums?.sha256 ?? '—'}
              </Typography>

              <Divider style={{ margin: '12px 0' }} />

              <Button
                variant="contained"
                color="primary"
                onClick={() =>
                  window.open(
                    fileInfo.downloadUri,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                Download (via Artifactory)
              </Button>
            </>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};
