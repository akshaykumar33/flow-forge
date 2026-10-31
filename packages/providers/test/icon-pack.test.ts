import { describe, expect, it } from 'vitest';
import type { GraphModel } from '@flowforge/core';
import { iconFileWords, iconsForModel, indexIconPack } from '../src/index.js';

const svg = (name: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><title>${name}</title></svg>`;

describe('iconFileWords', () => {
  it.each([
    ['Icons/databases/10130-icon-service-SQL-Database.svg', 'sql database'],
    ['Architecture-Service-Icons/Arch_Database/64/Arch_Amazon-DynamoDB_64.svg', 'amazon dynamodb'],
    ['Resource-Icons/Res_Amazon-DynamoDB_Table_48_Light.svg', 'amazon dynamodb table'],
    ['cloud_run/Cloud-Run.svg', 'cloud run'],
    ['cloud_run.svg', 'cloud run'],
  ])('%s → %s', (path, words) => {
    expect(iconFileWords(path)).toBe(words);
  });
});

describe('indexIconPack', () => {
  it('matches Azure files by product name, without the "Azure" prefix or with a plural', () => {
    const { index, missing } = indexIconPack('azure', [
      { path: '10130-icon-service-SQL-Database.svg', svg: svg('sql') },
      { path: '10121-icon-service-Azure-Cosmos-DB.svg', svg: svg('cosmos') },
      { path: '10035-icon-service-App-Services.svg', svg: svg('app service') },
    ]);
    expect(index.get('azure.sql-database')).toBe(svg('sql'));
    expect(index.get('azure.cosmos-db')).toBe(svg('cosmos'));
    expect(index.get('azure.app-service')).toBe(svg('app service'));
    expect(missing).toContain('azure.key-vault');
  });

  it('prefers AWS 64 px service icons over smaller sizes and resource icons', () => {
    const { index } = indexIconPack('aws', [
      { path: 'Arch_Amazon-DynamoDB_16.svg', svg: svg('16') },
      { path: 'Res_Amazon-DynamoDB_48.svg', svg: svg('res') },
      { path: 'Arch_Amazon-DynamoDB_64.svg', svg: svg('64') },
      { path: 'Arch_Amazon-DynamoDB_32.svg', svg: svg('32') },
    ]);
    expect(index.get('aws.dynamodb')).toBe(svg('64'));
  });

  it('only indexes services of the pack’s own provider', () => {
    const { index } = indexIconPack('gcp', [{ path: 'Cloud-Run.svg', svg: svg('run') }]);
    expect([...index.keys()]).toEqual(['gcp.cloud-run']);
    const aws = indexIconPack('aws', [{ path: 'Cloud-Run.svg', svg: svg('run') }]);
    expect(aws.index.size).toBe(0);
  });

  it('is deterministic regardless of file order', () => {
    const files = [
      { path: 'b/Arch_AWS-Lambda_64.svg', svg: svg('b') },
      { path: 'a/Arch_AWS-Lambda_64.svg', svg: svg('a') },
    ];
    expect(indexIconPack('aws', files).index.get('aws.lambda')).toBe(svg('a'));
    expect(indexIconPack('aws', [...files].reverse()).index.get('aws.lambda')).toBe(svg('a'));
  });
});

describe('iconsForModel', () => {
  it('maps nodes with a recognised service to the pack icon, and nothing else', () => {
    const model: GraphModel = {
      version: 1,
      diagramType: 'flowchart',
      direction: 'LR',
      groups: [],
      edges: [],
      nodes: [
        {
          id: 'fn',
          label: 'Lambda',
          shape: 'rectangle',
          inferences: [
            {
              key: 'service',
              value: 'aws.lambda',
              confidence: 1,
              provenance: 'deterministic',
              reason: '',
            },
          ],
        },
        { id: 'db', label: 'database', shape: 'cylinder', inferences: [] },
      ],
    };
    const { index } = indexIconPack('aws', [
      { path: 'Arch_AWS-Lambda_64.svg', svg: svg('lambda') },
    ]);
    expect(iconsForModel(model, [index])).toEqual({ fn: svg('lambda') });
  });
});
