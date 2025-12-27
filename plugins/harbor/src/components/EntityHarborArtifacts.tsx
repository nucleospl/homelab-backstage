import { useEffect, useMemo, useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Progress, WarningPanel } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@material-ui/core';

type HarborArtifact = {
  digest: string;
  size?: number;
  push_time?: string;
  pull_time?: string;
  tags?: Array<{ name?: string }>;
  labels?: Array<{ name?: string }>;
};

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return '-';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(2)}${units[i]}`;
}

function shortDigest(digest: string) {
  const d = digest.startsWith('sha256:')
    ? digest.slice('sha256:'.length)
    : digest;
  return `sha256:${d.slice(0, 7)}`;
}

function toLocal(ts?: string) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

async function readTextSafe(r: Response) {
  try {
    return await r.text();
  } catch {
    return `${r.status} ${r.statusText}`;
  }
}

export function EntityHarborArtifacts() {
  const { entity } = useEntity();
  const repoRef =
    entity.metadata.annotations?.['harbor.maksonlee.com/repository'];
  const fetchApi = useApi(fetchApiRef);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const [{ loading, error, value }, run] = useAsyncFn(async () => {
    if (!repoRef) return [] as HarborArtifact[];

    const [project, repository] = repoRef.split('/');
    if (!project || !repository) {
      throw new Error(
        'Invalid harbor.maksonlee.com/repository (expected: <project>/<repository>)',
      );
    }

    const url =
      `/api/proxy/harbor/api/v2.0/projects/${encodeURIComponent(project)}` +
      `/repositories/${encodeURIComponent(repository)}` +
      `/artifacts?with_tag=true&with_label=true&page=1&page_size=100`;

    const r = await fetchApi.fetch(url);
    if (!r.ok) {
      const body = await readTextSafe(r);
      throw new Error(
        `Harbor API failed: ${r.status} ${r.statusText} — ${body}`,
      );
    }

    return (await r.json()) as HarborArtifact[];
  }, [repoRef, fetchApi]);

  useEffect(() => {
    run();
  }, [run]);

  const rows = useMemo(() => {
    return (value ?? []).map(a => {
      const tags = (a.tags ?? []).map(t => t?.name).filter(Boolean) as string[];
      const labels = (a.labels ?? [])
        .map(l => l?.name)
        .filter(Boolean) as string[];

      return {
        digest: a.digest,
        artifact: shortDigest(a.digest),
        tags: tags.length ? tags.join(', ') : '-',
        size: formatBytes(a.size),
        labels: labels.length ? labels.join(', ') : '-',
        pushTime: toLocal(a.push_time),
        pullTime: toLocal(a.pull_time),
      };
    });
  }, [value]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => {
      return (
        r.artifact.toLowerCase().includes(q) ||
        r.digest.toLowerCase().includes(q) ||
        r.tags.toLowerCase().includes(q) ||
        r.labels.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const allSelected =
    filtered.length > 0 && filtered.every(r => selected[r.digest] === true);

  const toggleAll = () => {
    if (allSelected) {
      const next = { ...selected };
      for (const r of filtered) delete next[r.digest];
      setSelected(next);
      return;
    }
    const next = { ...selected };
    for (const r of filtered) next[r.digest] = true;
    setSelected(next);
  };

  const toggleOne = (digest: string) => {
    setSelected(s => ({ ...s, [digest]: !s[digest] }));
  };

  if (!repoRef) {
    return (
      <WarningPanel title="Harbor repository not configured">
        Add annotation <code>harbor.maksonlee.com/repository</code> to this
        entity.
      </WarningPanel>
    );
  }

  if (loading) return <Progress />;
  if (error) {
    return (
      <WarningPanel title="Failed to load Harbor artifacts">
        {String(error)}
      </WarningPanel>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        gridGap={16}
      >
        <Button variant="outlined" onClick={() => run()}>
          Refresh
        </Button>

        <TextField
          variant="outlined"
          size="small"
          placeholder="Search"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
            </TableCell>
            <TableCell>Artifacts</TableCell>
            <TableCell>Tags</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Labels</TableCell>
            <TableCell>Push Time</TableCell>
            <TableCell>Pull Time</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {filtered.map(r => (
            <TableRow key={r.digest} hover>
              <TableCell padding="checkbox">
                <input
                  type="checkbox"
                  checked={selected[r.digest] === true}
                  onChange={() => toggleOne(r.digest)}
                />
              </TableCell>
              <TableCell>{r.artifact}</TableCell>
              <TableCell>{r.tags}</TableCell>
              <TableCell>{r.size}</TableCell>
              <TableCell>{r.labels}</TableCell>
              <TableCell>{r.pushTime}</TableCell>
              <TableCell>{r.pullTime}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
